// routes/forms/controlNumberRoute.js
const express = require("express");
const router = express.Router();

// year_table (active school year) lives in db3 per your setup —
// switch to `db` here if that's not the case.
const { db3 } = require("../database/database");
const { generateFormControlNumber } = require("../../utils/formControlNumber");

// POST /api/generate-control-number
// body: { form_type, applicant_number, person_id, action_type }
// returns: { control_number }
router.post("/generate-control-number", async (req, res) => {
  try {
    const { form_type, applicant_number, person_id, action_type } = req.body;

    if (!form_type) {
      return res.status(400).json({ message: "form_type is required" });
    }

    const controlNumber = await generateFormControlNumber(db3, {
      formType: form_type,
      applicantNumber: applicant_number,
      personId: person_id,
      actionType: action_type || "download",
    });

    return res.json({ control_number: controlNumber });
  } catch (err) {
    console.error("Control number generation failed:", err);
    return res.status(500).json({
      message: "Failed to generate control number",
      error: err.message,
    });
  }
});

module.exports = router;