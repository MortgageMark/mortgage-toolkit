// modules/screens/LODashboard.js
const { useState, useEffect, useMemo } = React;
const useThemeColors = window.useThemeColors;
const supabase = window._supabaseClient;

function LODashboard({ user }) {
  const c = useThemeColors();
  const font = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  const [loading, setLoading] = useState(true);
  const [scenarios, setScenarios] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [letters, setLetters] = useState([]);
  const [fuRows, setFuRows] = useState([]); // contacts with fu_date

  useEffect(function() {
    if (!supabase) return;
    async function load() {
      setLoading(true);
      var twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 11);
      twelveMonthsAgo.setDate(1);
      var since = twelveMonthsAgo.toISOString().slice(0, 10);

      var [scenRes, contactRes, letterRes, fuRes] = await Promise.all([
        supabase.from("scenarios")
          .select("id, lead_status, loan_purpose, lead_source, created_at, actual_close_date, target_close_date, contact_id")
          .neq("status", "deleted"),
        supabase.from("contacts")
          .select("id, first_name, last_name, referred_by_contact_id, contact_category, contact_type"),
        supabase.from("pq_letters")
          .select("id, created_at")
          .gte("created_at", since + "T00:00:00Z"),
        supabase.from("contacts")
          .select("id, first_name, last_name, fu_date, fu_who")
          .not("fu_date", "is", null),
      ]);

      setScenarios(scenRes.data || []);
      setContacts(contactRes.data || []);
      setLetters(letterRes.data || []);
      setFuRows(fuRes.data || []);
      setLoading(false);
    }
    load();
  }, []);

  // ── Only scenarios with a non-blank lead_status are "leads" ──
  const leads = useMemo(function() {
    return scenarios.filter(function(s) { return s.lead_status && s.lead_status.trim() !== ""; });
  }, [scenarios]);

  // ── Pipeline group counts ──
  const LEAD_STATUSES = window.LEAD_STATUSES || [];
  const groupCounts = useMemo(function() {
    var counts = { pre: 0, active: 0, waiting: 0, archived: 0 };
    leads.forEach(function(s) {
      var match = LEAD_STATUSES.find(function(ls) { return ls.value === s.lead_status; });
      var g = match ? match.group : "pre";
      if (counts[g] !== undefined) counts[g]++;
    });
    return counts;
  }, [leads]);

  // ── Month labels for last 12 months ──
  const monthLabels = useMemo(function() {
    var labels = [];
    for (var i = 11; i >= 0; i--) {
      var d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - i);
      labels.push({ key: d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0"), label: d.toLocaleString("default", { month: "short" }) });
    }
    return labels;
  }, []);

  // ── Leads by month (created_at) ──
  const leadsByMonth = useMemo(function() {
    var map = {};
    monthLabels.forEach(function(m) { map[m.key] = 0; });
    leads.forEach(function(s) {
      var key = (s.created_at || "").slice(0, 7);
      if (map[key] !== undefined) map[key]++;
    });
    return monthLabels.map(function(m) { return { label: m.label, count: map[m.key] }; });
  }, [leads, monthLabels]);

  // ── Closings by month (actual_close_date) ──
  const closingsByMonth = useMemo(function() {
    var map = {};
    monthLabels.forEach(function(m) { map[m.key] = 0; });
    leads.forEach(function(s) {
      var d = s.actual_close_date || "";
      var key = d.slice(0, 7);
      if (map[key] !== undefined) map[key]++;
    });
    return monthLabels.map(function(m) { return { label: m.label, count: map[m.key] }; });
  }, [leads, monthLabels]);

  // ── This month stats ──
  const thisMonthKey = useMemo(function() {
    var d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
  }, []);

  const thisMonthLeads    = leadsByMonth[leadsByMonth.length - 1]?.count || 0;
  const thisMonthClosings = closingsByMonth[closingsByMonth.length - 1]?.count || 0;
  const thisMonthLetters  = useMemo(function() {
    return letters.filter(function(l) { return (l.created_at || "").slice(0, 7) === thisMonthKey; }).length;
  }, [letters, thisMonthKey]);

  // ── Follow-ups ──
  const today = useMemo(function() {
    var d = new Date(); d.setHours(0, 0, 0, 0); return d;
  }, []);
  const in5Days = useMemo(function() {
    var d = new Date(today); d.setDate(d.getDate() + 5); return d;
  }, [today]);

  const fuStats = useMemo(function() {
    var overdue = 0, todayCount = 0, next5 = [];
    fuRows.forEach(function(row) {
      if (!row.fu_date) return;
      var d = new Date(row.fu_date + "T00:00:00");
      if (d < today) overdue++;
      else if (d.getTime() === today.getTime()) todayCount++;
      else if (d <= in5Days) next5.push({ name: (row.first_name || "") + " " + (row.last_name || ""), date: row.fu_date, who: row.fu_who || "" });
    });
    next5.sort(function(a, b) { return a.date.localeCompare(b.date); });
    return { overdue, today: todayCount, next5 };
  }, [fuRows, today, in5Days]);

  // ── Top lead sources ──
  const topSources = useMemo(function() {
    var map = {};
    leads.forEach(function(s) {
      var src = (s.lead_source || "").trim();
      if (!src) return;
      map[src] = (map[src] || 0) + 1;
    });
    return Object.entries(map).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 6);
  }, [leads]);

  // ── Top referral contacts ──
  const topReferrals = useMemo(function() {
    var map = {};
    contacts.forEach(function(ct) {
      var ref = ct.referred_by_contact_id;
      if (!ref) return;
      map[ref] = (map[ref] || 0) + 1;
    });
    var contactsById = {};
    contacts.forEach(function(ct) { contactsById[ct.id] = ct; });
    return Object.entries(map)
      .sort(function(a, b) { return b[1] - a[1]; })
      .slice(0, 6)
      .map(function(e) {
        var ct = contactsById[e[0]];
        return { name: ct ? ((ct.first_name || "") + " " + (ct.last_name || "")).trim() : "Unknown", count: e[1], category: ct ? ct.contact_category : "" };
      });
  }, [contacts]);

  // ── Loan purpose breakdown ──
  const purposeCounts = useMemo(function() {
    var map = {};
    leads.forEach(function(s) {
      var p = s.loan_purpose || "purchase";
      map[p] = (map[p] || 0) + 1;
    });
    return Object.entries(map).sort(function(a, b) { return b[1] - a[1]; });
  }, [leads]);

  // ── Inline SVG bar chart ──
  function BarChart({ data, color, height }) {
    height = height || 80;
    var max = Math.max.apply(null, data.map(function(d) { return d.count; })) || 1;
    var barW = Math.floor(100 / data.length);
    return React.createElement("div", { style: { display: "flex", alignItems: "flex-end", gap: 2, height: height + 24, paddingTop: 4 } },
      data.map(function(d, i) {
        var h = Math.max(2, Math.round((d.count / max) * height));
        return React.createElement("div", { key: i, style: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 } },
          d.count > 0 && React.createElement("div", { style: { fontSize: 9, color: c.textSecondary, lineHeight: 1, fontFamily: font } }, d.count),
          React.createElement("div", {
            style: { width: "100%", height: h, background: color || "#2563eb", borderRadius: "3px 3px 0 0", transition: "height 0.3s" }
          }),
          React.createElement("div", { style: { fontSize: 9, color: c.textSecondary, lineHeight: 1, fontFamily: font, whiteSpace: "nowrap" } }, d.label)
        );
      })
    );
  }

  // ── Stat card ──
  function StatCard({ label, value, sub, accent, icon }) {
    return React.createElement("div", {
      style: { background: c.cardBg, border: "1px solid " + c.border, borderRadius: 10, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 4 }
    },
      React.createElement("div", { style: { fontSize: 11, color: c.textSecondary, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.07em", fontFamily: font } },
        icon ? icon + " " + label : label
      ),
      React.createElement("div", { style: { fontSize: 28, fontWeight: 800, color: accent || c.navy, fontFamily: font, lineHeight: 1 } }, value),
      sub && React.createElement("div", { style: { fontSize: 11, color: c.textSecondary, fontFamily: font } }, sub)
    );
  }

  // ── Section header ──
  function SectionHeader({ title }) {
    return React.createElement("div", {
      style: { fontSize: 13, fontWeight: 700, color: c.navy, fontFamily: font, marginBottom: 10, paddingBottom: 6, borderBottom: "1px solid " + c.border }
    }, title);
  }

  if (loading) {
    return React.createElement("div", { style: { padding: 40, textAlign: "center", color: c.textSecondary, fontFamily: font } }, "Loading dashboard…");
  }

  var cardGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 12, marginBottom: 24 };
  var section = { background: c.cardBg, border: "1px solid " + c.border, borderRadius: 12, padding: "18px 20px", marginBottom: 20 };

  return React.createElement("div", { style: { padding: "24px 28px", maxWidth: 960, margin: "0 auto", fontFamily: font } },

    // ── Page title ──
    React.createElement("div", { style: { marginBottom: 24 } },
      React.createElement("h1", { style: { fontSize: 22, fontWeight: 800, color: c.navy, margin: 0, fontFamily: font } }, "📊 Dashboard"),
      React.createElement("div", { style: { fontSize: 13, color: c.textSecondary, marginTop: 4, fontFamily: font } },
        "Your pipeline at a glance · " + leads.length + " active lead" + (leads.length !== 1 ? "s" : "") + " · " + scenarios.length + " total scenarios"
      )
    ),

    // ── This Month at a Glance ──
    React.createElement("div", cardGrid,
      React.createElement(StatCard, { label: "New Leads This Month", value: thisMonthLeads, icon: "🌱", accent: "#2563eb" }),
      React.createElement(StatCard, { label: "Closings This Month",  value: thisMonthClosings, icon: "🏠", accent: "#16a34a" }),
      React.createElement(StatCard, { label: "Letters Generated",    value: thisMonthLetters, icon: "📄", accent: "#7c3aed" }),
      React.createElement(StatCard, { label: "Follow-ups Overdue",   value: fuStats.overdue, icon: "⚠️", accent: fuStats.overdue > 0 ? "#dc2626" : c.navy }),
      React.createElement(StatCard, { label: "Follow-ups Today",     value: fuStats.today, icon: "📅", accent: fuStats.today > 0 ? "#d97706" : c.navy }),
      React.createElement(StatCard, { label: "Total Pipeline Leads", value: leads.length, icon: "🎯", accent: c.navy })
    ),

    // ── Pipeline Breakdown ──
    React.createElement("div", { style: Object.assign({}, section) },
      React.createElement(SectionHeader, { title: "Pipeline Breakdown" }),
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 } },
        [
          { label: "Pre-Pipeline", key: "pre",      color: "#94a3b8" },
          { label: "Active",       key: "active",   color: "#2563eb" },
          { label: "Waiting",      key: "waiting",  color: "#d97706" },
          { label: "Archived",     key: "archived", color: "#6b7280" },
        ].map(function(g) {
          return React.createElement("div", {
            key: g.key,
            style: { background: c.bg, border: "1px solid " + c.border, borderRadius: 8, padding: "12px 14px", textAlign: "center" }
          },
            React.createElement("div", { style: { fontSize: 22, fontWeight: 800, color: g.color, lineHeight: 1 } }, groupCounts[g.key] || 0),
            React.createElement("div", { style: { fontSize: 11, color: c.textSecondary, fontWeight: 600, marginTop: 4, textTransform: "uppercase", letterSpacing: "0.06em" } }, g.label)
          );
        })
      )
    ),

    // ── Charts row ──
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 } },

      // Leads by Month
      React.createElement("div", { style: section },
        React.createElement(SectionHeader, { title: "New Leads — Last 12 Months" }),
        React.createElement(BarChart, { data: leadsByMonth, color: "#2563eb", height: 80 })
      ),

      // Closings by Month
      React.createElement("div", { style: section },
        React.createElement(SectionHeader, { title: "Closings — Last 12 Months" }),
        React.createElement(BarChart, { data: closingsByMonth, color: "#16a34a", height: 80 })
      )
    ),

    // ── Follow-ups coming up ──
    React.createElement("div", { style: section },
      React.createElement(SectionHeader, { title: "Follow-ups: Next 5 Days" }),
      fuStats.next5.length === 0
        ? React.createElement("div", { style: { color: c.textSecondary, fontSize: 13 } }, "No follow-ups scheduled in the next 5 days.")
        : React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
            fuStats.next5.map(function(row, i) {
              var d = new Date(row.date + "T00:00:00");
              var label = d.toLocaleDateString("default", { weekday: "short", month: "short", day: "numeric" });
              return React.createElement("div", {
                key: i,
                style: { display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", background: c.bg, borderRadius: 7, border: "1px solid " + c.border }
              },
                React.createElement("div", { style: { fontSize: 20 } }, "📞"),
                React.createElement("div", { style: { flex: 1 } },
                  React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: c.navy } }, row.name || "Contact"),
                  row.who && React.createElement("div", { style: { fontSize: 11, color: c.textSecondary } }, "Assigned to: " + row.who)
                ),
                React.createElement("div", { style: { fontSize: 12, color: "#2563eb", fontWeight: 600 } }, label)
              );
            })
          )
    ),

    // ── Top Sources + Top Referrals ──
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 } },

      // Top Lead Sources
      React.createElement("div", { style: section },
        React.createElement(SectionHeader, { title: "Top Lead Sources" }),
        topSources.length === 0
          ? React.createElement("div", { style: { color: c.textSecondary, fontSize: 13 } }, "No lead source data yet.")
          : React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
              topSources.map(function(e, i) {
                var maxCount = topSources[0][1];
                var pct = Math.round((e[1] / maxCount) * 100);
                return React.createElement("div", { key: i, style: { display: "flex", flexDirection: "column", gap: 3 } },
                  React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: font } },
                    React.createElement("span", { style: { color: c.navy, fontWeight: 600 } }, e[0]),
                    React.createElement("span", { style: { color: c.textSecondary } }, e[1] + " lead" + (e[1] !== 1 ? "s" : ""))
                  ),
                  React.createElement("div", { style: { height: 6, background: c.border, borderRadius: 3, overflow: "hidden" } },
                    React.createElement("div", { style: { height: "100%", width: pct + "%", background: "#2563eb", borderRadius: 3 } })
                  )
                );
              })
            )
      ),

      // Top Referral Contacts
      React.createElement("div", { style: section },
        React.createElement(SectionHeader, { title: "Top Referral Partners" }),
        topReferrals.length === 0
          ? React.createElement("div", { style: { color: c.textSecondary, fontSize: 13 } }, "No referral data yet.")
          : React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 6 } },
              topReferrals.map(function(r, i) {
                var maxCount = topReferrals[0].count;
                var pct = Math.round((r.count / maxCount) * 100);
                return React.createElement("div", { key: i, style: { display: "flex", flexDirection: "column", gap: 3 } },
                  React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 12, fontFamily: font } },
                    React.createElement("div", null,
                      React.createElement("span", { style: { color: c.navy, fontWeight: 600 } }, r.name),
                      r.category && React.createElement("span", { style: { color: c.textSecondary, marginLeft: 6, fontSize: 11 } }, r.category)
                    ),
                    React.createElement("span", { style: { color: c.textSecondary } }, r.count + " referral" + (r.count !== 1 ? "s" : ""))
                  ),
                  React.createElement("div", { style: { height: 6, background: c.border, borderRadius: 3, overflow: "hidden" } },
                    React.createElement("div", { style: { height: "100%", width: pct + "%", background: "#7c3aed", borderRadius: 3 } })
                  )
                );
              })
            )
      )
    ),

    // ── Loan Purpose Mix ──
    purposeCounts.length > 0 && React.createElement("div", { style: section },
      React.createElement(SectionHeader, { title: "Loan Purpose Mix" }),
      React.createElement("div", { style: { display: "flex", gap: 12, flexWrap: "wrap" } },
        purposeCounts.map(function(e, i) {
          var colors = ["#2563eb", "#16a34a", "#d97706", "#7c3aed", "#0891b2"];
          var pct = leads.length > 0 ? Math.round((e[1] / leads.length) * 100) : 0;
          return React.createElement("div", {
            key: i,
            style: { background: c.bg, border: "1px solid " + c.border, borderRadius: 8, padding: "10px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: 2, minWidth: 100 }
          },
            React.createElement("div", { style: { fontSize: 20, fontWeight: 800, color: colors[i % colors.length] } }, e[1]),
            React.createElement("div", { style: { fontSize: 11, color: c.navy, fontWeight: 600, textTransform: "capitalize" } }, e[0].replace(/-/g, " ")),
            React.createElement("div", { style: { fontSize: 11, color: c.textSecondary } }, pct + "% of leads")
          );
        })
      )
    )
  );
}

window.LODashboard = LODashboard;
