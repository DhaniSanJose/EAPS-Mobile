import React, { useState, useContext, useEffect, useCallback } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  FormControl,
  Select,
  MenuItem,
  CircularProgress,
  Divider,
} from "@mui/material";
import DownloadIcon from "@mui/icons-material/Download";
import RefreshIcon from "@mui/icons-material/Refresh";
import API_BASE_URL from "../apiConfig";
import EaristLogo from "../assets/EaristLogo.png";

const PERIOD_LABELS = { day: "Today", week: "This Week", month: "This Month" };

const formatDate = (value) => {
  if (!value) return "N/A";
  const d = new Date(value);
  if (isNaN(d)) return String(value);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
};

const formatFormType = (type) =>
  ({
    changeCourse: "Change Course (College Dean)",
    changeCourse1: "Change Course (Campus Director)",
    newForm: "Empty Change Course (College Dean)",
    newForm1: "Empty Change Course (Campus Director)",
  })[type] ||
  type ||
  "N/A";

const formatExamResultStatus = (status) => {
  if (status === null || status === undefined || status === "") return "N/A";
  return Number(status) === 0
    ? "PASSED"
    : Number(status) === 1
      ? "FAILED"
      : "N/A";
};

const fullName = (r) =>
  `${r.last_name || ""}, ${r.first_name || ""} ${r.middle_name ? r.middle_name.charAt(0) + "." : ""}${r.extension ? " " + r.extension : ""}`.trim();

// Resolves a branch/campus id to its display label. Handles the
// `branch` (canonical) vs `branch_name` (legacy fallback) field split.
const campusLabelFor = (campuses, campusId) => {
  if (!campusId || campusId === "all") return null;
  const match = campuses.find((c) => String(c.id) === String(campusId));
  return match ? match.branch || match.branch_name || "Unnamed Branch" : null;
};

// ── Report definitions: one entry per box ──────────────────────────────
const REPORT_DEFS = [
  {
    key: "ecat_takers",
    title: "ECAT Exam Takers",
    color: "#1565c0",
    listEndpoint: "/api/reports/ecat-takers/list",
    fileNamePrefix: "ECAT_Exam_Takers",
    columns: [
      { label: "Applicant No.", value: (r) => r.applicant_number || "N/A" },
      { label: "Name", value: fullName },
      { label: "Score", value: (r) => r.total_score ?? "N/A" },
      { label: "Result", value: (r) => formatExamResultStatus(r.status) },
      { label: "Date Taken", value: (r) => formatDate(r.date_created) },
    ],
  },
  {
    key: "non_appearance",
    title: "Entrance Exam Non-Appearance",
    subtitle: "From QR attendance scanner",
    color: "#c62828",
    listEndpoint: "/api/reports/non-appearance/list",
    fileNamePrefix: "Exam_Non_Appearance",
    columns: [
      { label: "Applicant No.", value: (r) => r.applicant_id || "N/A" },
      { label: "Name", value: fullName },
      { label: "Exam Date", value: (r) => formatDate(r.exam_date) },
      { label: "Room", value: (r) => r.room_description || "N/A" },
      { label: "Status", value: () => "DID NOT APPEAR" },
    ],
  },
  {
    key: "realignment",
    title: "Applicant Realignment",
    subtitle: "Change Course Form issuances",
    color: "#6a1b9a",
    listEndpoint: "/api/reports/realignment/list",
    fileNamePrefix: "Applicant_Realignment",
    columns: [
      { label: "Applicant No.", value: (r) => r.applicant_number || "N/A" },
      { label: "Name", value: (r) => r.applicant_name || "N/A" },
      { label: "Form Type", value: (r) => formatFormType(r.form_type) },
      { label: "Control No.", value: (r) => r.control_number || "N/A" },
      {
        label: "Changed Program?",
        value: (r) =>
          r.from_curriculum_id != null &&
          String(r.from_curriculum_id) !== String(r.current_curriculum_id)
            ? "YES"
            : "NO",
      },
      { label: "Date Issued", value: (r) => formatDate(r.created_at) },
    ],
  },
  {
    key: "ecat_results",
    title: "ECAT Passers / Failers",
    color: "#2e7d32",
    listEndpoint: "/api/reports/ecat-results/list",
    fileNamePrefix: "ECAT_Passers_Failers",
    hasStatusFilter: true,
    columns: [
      { label: "Applicant No.", value: (r) => r.applicant_number || "N/A" },
      { label: "Name", value: fullName },
      { label: "Score", value: (r) => r.total_score ?? "N/A" },
      { label: "Result", value: (r) => formatExamResultStatus(r.status) },
      { label: "Date", value: (r) => formatDate(r.date_created) },
    ],
  },
];

// ── campuses / selectedCampus are passed down from AdmissionOfficerDashboard
// so the campus filter stays in sync with the rest of the dashboard. ──────
const AdmissionsReportPanel = ({ campuses = [], selectedCampus = "all" }) => {
  const settings = useContext(SettingsContext);
  const colors = settings?.colors || {};
  const branding = settings?.branding || {};
  const assets = settings?.assets || {};
  const headerColor = colors.header || "#1976d2";
  const [summary, setSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [periods, setPeriods] = useState({
    ecat_takers: "month",
    non_appearance: "month",
    realignment: "month",
    ecat_results: "month",
  });
  const [resultsStatusFilter, setResultsStatusFilter] = useState("all");
  const [downloadingKey, setDownloadingKey] = useState(null);

  const fetchSummary = useCallback(async () => {
    setLoadingSummary(true);
    try {
      const params = selectedCampus !== "all" ? { campus: selectedCampus } : {};
      const res = await axios.get(
        `${API_BASE_URL}/api/reports/admissions-summary`,
        {
          params,
        },
      );
      setSummary(res.data);
    } catch (err) {
      console.error("Error fetching admissions summary:", err);
    } finally {
      setLoadingSummary(false);
    }
  }, [selectedCampus]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const campusAddressFor = (campuses, campusId, fallback) => {
    if (!campusId || campusId === "all") return fallback;
    const match = campuses.find((c) => String(c.id) === String(campusId));
    return match?.address || fallback;
  };

  const buildTableHtml = (title, columns, rows) => {
    // ── Same letterhead build as handleExportApplicantListPdf ──
    const logoSrc = assets.logoUrl || EaristLogo;
    const companyName = (branding.companyName || "").trim();
    const words = companyName.split(" ");
    const middleIndex = Math.ceil(words.length / 2);
    const firstLine = words.slice(0, middleIndex).join(" ");
    const secondLine = words.slice(middleIndex).join(" ");

    const resolvedCampusAddress = campusAddressFor(
      campuses,
      selectedCampus,
      branding.campusAddress || "No address set in Settings",
    );
    const campusLabel = campusLabelFor(campuses, selectedCampus);
    const generatedAt = new Date().toLocaleString("en-US");

    const headerRow = `<tr>${columns.map((c) => `<th>${c.label}</th>`).join("")}</tr>`;
    const bodyRows = rows.length
      ? rows
          .map(
            (r) =>
              `<tr>${columns
                .map(
                  (c) =>
                    `<td${c.label === "Name" ? ' class="applicant-name"' : ""}>${c.value(r)}</td>`,
                )
                .join("")}</tr>`,
          )
          .join("")
      : `<tr><td colspan="${columns.length}" style="padding:14px;">No records found for this period.</td></tr>`;

    return `
    <div class="print-header">

      <div class="header-content">
        <img src="${logoSrc}" alt="School Logo" />

        <div class="header-text">
          <div style="font-size: 12px; font-family: Arial">Republic of the Philippines</div>

          ${
            companyName
              ? `
              <b style="letter-spacing: 1px; font-size: 18px; font-family: Arial, sans-serif;">
                ${firstLine}
              </b>
              ${
                secondLine
                  ? `<div style="letter-spacing: 1px; font-size: 18px; font-family: Arial, sans-serif;">
                     <b>${secondLine}</b>
                   </div>`
                  : ""
              }
            `
              : ""
          }

          <div style="font-size: 12px; font-family: Arial">${resolvedCampusAddress}</div>
        </div>
      </div>

      <div style="margin-top: 20px; text-align: center;">
        <b style="font-size: 20px; letter-spacing: 1px;">${title}</b>
      </div>
    
    </div>

    <div class="table-wrapper">
      <table>
        <thead>${headerRow}</thead>
        <tbody>${bodyRows}</tbody>
      </table>
    </div>
  `;
  };

  const handleDownload = async (def) => {
    const period = periods[def.key];
    setDownloadingKey(def.key);
    try {
      const params = { period };
      if (def.hasStatusFilter && resultsStatusFilter !== "all") {
        params.status = resultsStatusFilter;
      }
      if (selectedCampus !== "all") {
        params.campus = selectedCampus;
      }

      const listRes = await axios.get(`${API_BASE_URL}${def.listEndpoint}`, {
        params,
      });
      const rows = Array.isArray(listRes.data) ? listRes.data : [];

      const campusLabel = campusLabelFor(campuses, selectedCampus);
      const title = `${def.title} \u2014 ${PERIOD_LABELS[period]}${campusLabel ? ` (${campusLabel})` : ""}`;
      const html = buildTableHtml(title, def.columns, rows);

      // Reuses the existing generic report PDF route (see
      // routes/forms/downloadableFormsRoute.js ->
      // POST /generate-attendance-report-pdf) instead of adding a new
      // puppeteer route per report.
      const pdfRes = await axios.post(
        `${API_BASE_URL}/api/generate-attendance-report-pdf`,
        { html, title, fileNamePrefix: `${def.fileNamePrefix}_${period}` },
        { responseType: "blob" },
      );

      const blob = new Blob([pdfRes.data], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${def.fileNamePrefix}_${period}_${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error(`Error downloading ${def.title} report:`, err);
      alert(`Failed to generate the ${def.title} report. Please try again.`);
    } finally {
      setDownloadingKey(null);
    }
  };

  const renderCountRow = (label, value) => (
    <Box sx={{ display: "flex", justifyContent: "space-between", py: 0.25 }}>
      <Typography fontSize={13} color="text.secondary">
        {label}
      </Typography>
      <Typography fontSize={13} fontWeight="bold">
        {value ?? 0}
      </Typography>
    </Box>
  );

  const activeCampusLabel = campusLabelFor(campuses, selectedCampus);

  return (
    <Box sx={{ mt: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 1.5,
          flexWrap: "wrap",
          gap: 1,
        }}
      >
        <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
          <Typography variant="h6" fontWeight="bold">
            Admissions Report
          </Typography>
          {activeCampusLabel && (
            <Typography fontSize={13} color="text.secondary">
              — {activeCampusLabel}
            </Typography>
          )}
        </Box>
        <Button
          size="small"
          startIcon={
            loadingSummary ? <CircularProgress size={14} /> : <RefreshIcon />
          }
          onClick={fetchSummary}
          disabled={loadingSummary}
        >
          Refresh
        </Button>
      </Box>

      <Grid container spacing={2}>
        {REPORT_DEFS.map((def) => {
          const counts = summary?.[def.key];
          return (
            <Grid item xs={12} sm={6} lg={3} key={def.key}>
              <Card
                sx={{
                  height: "100%",
                  borderRadius: 3,
                  boxShadow: 3,
                  borderTop: `4px solid ${def.color}`,
                }}
              >
                <CardContent>
                  <Typography
                    fontWeight="bold"
                    fontSize={14}
                    sx={{ color: def.color }}
                  >
                    {def.title}
                  </Typography>
                  {def.subtitle && (
                    <Typography
                      fontSize={11}
                      color="text.secondary"
                      sx={{ mb: 0.5 }}
                    >
                      {def.subtitle}
                    </Typography>
                  )}

                  <Box sx={{ mt: 1, mb: 1 }}>
                    {def.key === "ecat_results" ? (
                      <>
                        {renderCountRow(
                          "Today (PASSED / FAILED)",
                          `${summary?.ecat_results?.today_passed ?? 0} / ${summary?.ecat_results?.today_failed ?? 0}`,
                        )}
                        {renderCountRow(
                          "This Week (PASSED / FAILED)",
                          `${summary?.ecat_results?.week_passed ?? 0} / ${summary?.ecat_results?.week_failed ?? 0}`,
                        )}
                        {renderCountRow(
                          "This Month (PASSED / FAILED)",
                          `${summary?.ecat_results?.month_passed ?? 0} / ${summary?.ecat_results?.month_failed ?? 0}`,
                        )}
                      </>
                    ) : (
                      <>
                        {renderCountRow("Today", counts?.today)}
                        {renderCountRow("This Week", counts?.this_week)}
                        {renderCountRow("This Month", counts?.this_month)}
                      </>
                    )}
                  </Box>

                  <Divider sx={{ my: 1 }} />

                  <Box
                    sx={{
                      display: "flex",
                      gap: 1,
                      alignItems: "center",
                      flexWrap: "wrap",
                    }}
                  >
                    <FormControl size="small" sx={{ minWidth: 100 }}>
                      <Select
                        value={periods[def.key]}
                        onChange={(e) =>
                          setPeriods((p) => ({
                            ...p,
                            [def.key]: e.target.value,
                          }))
                        }
                      >
                        <MenuItem value="day">Day</MenuItem>
                        <MenuItem value="week">Week</MenuItem>
                        <MenuItem value="month">Month</MenuItem>
                      </Select>
                    </FormControl>

                    {def.hasStatusFilter && (
                      <FormControl size="small" sx={{ minWidth: 100 }}>
                        <Select
                          value={resultsStatusFilter}
                          onChange={(e) =>
                            setResultsStatusFilter(e.target.value)
                          }
                        >
                          <MenuItem value="all">All</MenuItem>
                          <MenuItem value="0">Passed</MenuItem>
                          <MenuItem value="1">Failed</MenuItem>
                        </Select>
                      </FormControl>
                    )}

                    <Button
                      size="small"
                      variant="contained"
                      startIcon={<DownloadIcon />}
                      onClick={() => handleDownload(def)}
                      disabled={downloadingKey === def.key}
                      sx={{
                        backgroundColor: def.color,
                        "&:hover": { opacity: 0.9, backgroundColor: def.color },
                      }}
                    >
                      {downloadingKey === def.key ? "Generating\u2026" : "PDF"}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    </Box>
  );
};

export default AdmissionsReportPanel;
