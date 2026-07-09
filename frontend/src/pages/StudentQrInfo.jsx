import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { Box, Container, Typography, Alert, CircularProgress } from "@mui/material";
import API_BASE_URL from "../apiConfig";

const StudentQrInfo = () => {
  const { studentNumber } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [info, setInfo] = useState(null);

  useEffect(() => {
    if (!studentNumber) {
      setError("Missing student number.");
      setLoading(false);
      return;
    }

    const fetchInfo = async () => {
      try {
        const res = await axios.get(
          `${API_BASE_URL}/student_qr_information/${encodeURIComponent(
            studentNumber,
          )}`,
        );
        setInfo(res.data || null);
        setError("");
      } catch (err) {
        const message =
          err?.response?.data?.error ||
          err?.response?.data?.message ||
          "Unable to load student information.";
        setError(message);
        setInfo(null);
      } finally {
        setLoading(false);
      }
    };

    fetchInfo();
  }, [studentNumber]);

  const fullName = info
    ? `${info.last_name || ""}, ${info.first_name || ""} ${
        info.middle_name || ""
      } ${info.extension || ""}`.trim()
    : "";

  return (
    <Box sx={{ minHeight: "100vh", py: 6, backgroundColor: "#f6f6f6" }}>
      <Container maxWidth="sm">
        <Box
          sx={{
            backgroundColor: "white",
            borderRadius: 2,
            p: 3,
            boxShadow: "0 6px 20px rgba(0,0,0,0.08)",
          }}
        >
          <Typography variant="h5" sx={{ fontWeight: "bold", mb: 2 }}>
            Student QR Information
          </Typography>

          {loading && (
            <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
              <CircularProgress />
            </Box>
          )}

          {!loading && error && (
            <Alert severity="error" variant="filled">
              {error}
            </Alert>
          )}

          {!loading && !error && info && (
            <Box sx={{ display: "grid", gap: 1.25 }}>
              <Typography>
                <b>Student Number:</b> {info.student_number || studentNumber}
              </Typography>
              <Typography>
                <b>Name:</b> {fullName || "-"}
              </Typography>
              <Typography>
                <b>Program:</b> {info.program || "-"}
              </Typography>
              <Typography>
                <b>Department:</b>{" "}
                {info.department_name || info.department_code
                  ? `${info.department_name || "-"} (${info.department_code || "-"})`
                  : "-"}
              </Typography>
              <Typography>
                <b>Year Level:</b>{" "}
                {info.year_level_description || info.year_level_id || "-"}
              </Typography>
              <Typography>
                <b>Status:</b>{" "}
                {Number(info.enrolled) === 1 ? "Enrolled" : "Not Enrolled"}
              </Typography>
            </Box>
          )}
        </Box>
      </Container>
    </Box>
  );
};

export default StudentQrInfo;
