const mysql = require("mysql2/promise");

const getDbHost = () => {
  if (process.env.NODE_ENV === 'production') {
    return process.env.DB_HOST_PUBLIC;
  } else if (process.env.NODE_ENV === 'local') {
    return process.env.DB_HOST_LOCAL;
  } else {
    return 'localhost'; // fallback for development
  }
};

//MYSQL CONNECTION FOR ADMISSION
const db = mysql.createPool({
  // host: "localhost",
  host: getDbHost(),
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME1 || "admission",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

//MYSQL CONNECTION FOR ROOM MANAGEMENT AND OTHERS
const db3 = mysql.createPool({
  // host: "localhost",
  host: getDbHost(),
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME2 || "enrollment",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ✅ EXPORT BOTH
let pageAccessPermissionColumnsReady;
let programSlotsEStatusColumnReady;
let scholarshipTypeCodeColumnReady;
let unifastUnitColumnsReady;
let matriculationUnitColumnsReady;

const ensurePageAccessPermissionColumns = async () => {
  if (!pageAccessPermissionColumnsReady) {
    pageAccessPermissionColumnsReady = (async () => {
      const requiredColumns = ["can_create", "can_edit", "can_delete"];
      const [columns] = await db3.query("SHOW COLUMNS FROM page_access");
      const existingColumns = new Set(columns.map((column) => column.Field));

      for (const column of requiredColumns) {
        if (!existingColumns.has(column)) {
          await db3.query(
            `ALTER TABLE page_access ADD COLUMN ${column} TINYINT(1) NOT NULL DEFAULT 0`,
          );
        }
      }
    })().catch((error) => {
      pageAccessPermissionColumnsReady = null;
      throw error;
    });
  }

  return pageAccessPermissionColumnsReady;
};

const ensureProgramSlotsEStatusColumn = async () => {
  if (!programSlotsEStatusColumnReady) {
    programSlotsEStatusColumnReady = (async () => {
      const [columns] = await db.query("SHOW COLUMNS FROM program_slots");
      const existingColumns = new Set(columns.map((column) => column.Field));

      if (!existingColumns.has("e_status")) {
        await db.query(
          "ALTER TABLE program_slots ADD COLUMN e_status TINYINT(1) NOT NULL DEFAULT 0",
        );
      }
    })().catch((error) => {
      programSlotsEStatusColumnReady = null;
      throw error;
    });
  }

  return programSlotsEStatusColumnReady;
};

const ensureScholarshipTypeCodeColumn = async () => {
  if (!scholarshipTypeCodeColumnReady) {
    scholarshipTypeCodeColumnReady = (async () => {
      const [columns] = await db3.query("SHOW COLUMNS FROM scholarship_type");
      const existingColumns = new Set(columns.map((column) => column.Field));

      if (!existingColumns.has("scholarship_code")) {
        await db3.query(
          "ALTER TABLE scholarship_type ADD COLUMN scholarship_code VARCHAR(255) NOT NULL DEFAULT '' AFTER id",
        );
      }
    })().catch((error) => {
      scholarshipTypeCodeColumnReady = null;
      throw error;
    });
  }

  return scholarshipTypeCodeColumnReady;
};

const ensureUnitColumns = async (tableName) => {
  const [columns] = await db3.query(`SHOW COLUMNS FROM ${tableName}`);
  const existingColumns = new Set(columns.map((column) => column.Field));
  const requiredColumns = [
    "laboratory_units",
    "computer_units",
    "academic_units_enrolled",
    "academic_units_nstp_enrolled",
  ];

  for (const column of requiredColumns) {
    if (!existingColumns.has(column)) {
      await db3.query(
        `ALTER TABLE ${tableName} ADD COLUMN ${column} DECIMAL(10,2) NOT NULL DEFAULT 0.00`,
      );
    }
  }
};

const ensureUnifastUnitColumns = async () => {
  if (!unifastUnitColumnsReady) {
    unifastUnitColumnsReady = (async () => {
      await ensureUnitColumns("unifast");
    })().catch((error) => {
      unifastUnitColumnsReady = null;
      throw error;
    });
  }

  return unifastUnitColumnsReady;
};

const ensureMatriculationUnitColumns = async () => {
  if (!matriculationUnitColumnsReady) {
    matriculationUnitColumnsReady = (async () => {
      await ensureUnitColumns("matriculation");
    })().catch((error) => {
      matriculationUnitColumnsReady = null;
      throw error;
    });
  }

  return matriculationUnitColumnsReady;
};

module.exports = {
  db,
  db3,
  ensurePageAccessPermissionColumns,
  ensureProgramSlotsEStatusColumn,
  ensureScholarshipTypeCodeColumn,
  ensureUnifastUnitColumns,
  ensureMatriculationUnitColumns,
};
