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

module.exports = {
  db,
  db3,
  ensurePageAccessPermissionColumns,
  ensureProgramSlotsEStatusColumn,
};
