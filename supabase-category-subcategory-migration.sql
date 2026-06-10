-- supabase-category-subcategory-migration.sql
-- Adds contact_subcategory column and migrates flat categories to new two-level structure

ALTER TABLE contacts ADD COLUMN IF NOT EXISTS contact_subcategory text;

-- Loan Officer → Lender / Loan Officer
UPDATE contacts SET contact_category = 'Lender', contact_subcategory = 'Loan Officer'
  WHERE contact_category = 'Loan Officer';

-- Employee → Lender / Employee
UPDATE contacts SET contact_category = 'Lender', contact_subcategory = 'Employee'
  WHERE contact_category = 'Employee';

-- Home Builder → Builder (no subcategory)
UPDATE contacts SET contact_category = 'Builder', contact_subcategory = NULL
  WHERE contact_category = 'Home Builder';

-- Individual vendor types → Vendor / [subcategory]
UPDATE contacts SET contact_category = 'Vendor', contact_subcategory = 'Appraiser'
  WHERE contact_category = 'Appraiser';
UPDATE contacts SET contact_category = 'Vendor', contact_subcategory = 'Insurance'
  WHERE contact_category = 'Insurance';
UPDATE contacts SET contact_category = 'Vendor', contact_subcategory = 'Title'
  WHERE contact_category = 'Title';

-- Loan: Third Party legacy → Vendor (no subcategory)
UPDATE contacts SET contact_category = 'Vendor', contact_subcategory = NULL
  WHERE contact_category = 'Loan: Third Party';

-- Financial Partner → Other / Financial
UPDATE contacts SET contact_category = 'Other', contact_subcategory = 'Financial'
  WHERE contact_category = 'Financial Partner';

-- Marketing → Other / Marketing
UPDATE contacts SET contact_category = 'Other', contact_subcategory = 'Marketing'
  WHERE contact_category = 'Marketing';

-- Personal → Other / Personal
UPDATE contacts SET contact_category = 'Other', contact_subcategory = 'Personal'
  WHERE contact_category = 'Personal';

-- Retired categories → Other (no subcategory)
UPDATE contacts SET contact_category = 'Other', contact_subcategory = NULL
  WHERE contact_category IN ('Recruit', 'Work Relationship', 'zz-Junk');
