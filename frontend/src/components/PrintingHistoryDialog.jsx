import React, { useContext, useEffect, useState } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import HistoryIcon from "@mui/icons-material/History";
import API_BASE_URL from "../apiConfig";
import { getAuditHeaders } from "../utils/auditEvents";

const PRINTING_APPLICANT_ACTION = "PRINTING_APPLICANT_DOCS";
const PRINTING_STUDENT_ACTION = "PRINTING_STUDENT_DOCS";

const formatHistoryTimestamp = (value) => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString("en-PH", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
};

const getCurrentEmployeeId = (employeeId) =>
  String(
    employeeId ||
      localStorage.getItem("employee_id") ||
      "",
  ).trim();

const PrintingHistoryDialog = ({
  buttonLabel = "View Printing History",
  employeeId = "",
  action = PRINTING_APPLICANT_ACTION,
  title = "My Printing History",
  disabled = false,
}) => {
  const settings = useContext(SettingsContext);
  const headerColor = settings?.header_color || "#1976d2";
  const borderColor = settings?.border_color || "#000000";

  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState("");

  const actorEmployeeId = getCurrentEmployeeId(employeeId);
  const historyAction = String(action || PRINTING_APPLICANT_ACTION).trim();

  const loadLogs = async () => {
    setLoading(true);
    setError("");

    const safeActorId = getCurrentEmployeeId(employeeId);
    if (!safeActorId) {
      setLogs([]);
      setError("No employee ID found for the current user.");
      setLoading(false);
      return;
    }

    try {
      const res = await axios.get(`${API_BASE_URL}/api/audit-logs`, {
        params: {
          action: historyAction,
          actor_id: safeActorId,
          limit: 200,
          page: 1,
        },
        headers: getAuditHeaders(),
      });

      const rows = Array.isArray(res.data?.data) ? res.data.data : [];
      const filtered = rows.filter(
        (row) =>
          String(row.action || "").trim() === historyAction &&
          String(row.email || "").trim() === safeActorId,
      );

      setLogs(filtered);
      if (!filtered.length) {
        setError(`No printing history found for employee ${safeActorId}.`);
      }
    } catch (err) {
      console.error("Failed to load printing history:", err);
      setLogs([]);
      setError("Failed to load printing history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    loadLogs();
  }, [open, employeeId, historyAction]);

  return (
    <>
      <Button
        variant="contained"
        startIcon={<HistoryIcon />}
        disabled={disabled || !actorEmployeeId}
        onClick={() => setOpen(true)}
        sx={{
          backgroundColor: headerColor,
          color: "#fff",
          textTransform: "none",
          fontWeight: 700,
          borderRadius: "10px",
          "&:hover": { backgroundColor: headerColor, opacity: 0.9 },
        }}
      >
        {buttonLabel}
      </Button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        fullWidth
        maxWidth="md"
        PaperProps={{
          sx: {
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
          },
        }}
      >
        <DialogTitle
          sx={{
            bgcolor: headerColor,
            color: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            fontWeight: "bold",
            px: 3,
            py: 2,
          }}
        >
          <Box display="flex" alignItems="center" gap={1.5}>
            <Box
              sx={{
                backgroundColor: "rgba(255,255,255,0.2)",
                borderRadius: "50%",
                width: 40,
                height: 40,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <HistoryIcon />
            </Box>
            <Box>
              <Typography sx={{ fontWeight: 700, fontSize: "1.1rem" }}>
                {title}
              </Typography>
              <Typography sx={{ fontSize: "0.8rem", opacity: 0.9 }}>
                Action: {historyAction}
                {actorEmployeeId ? ` · Employee ID ${actorEmployeeId}` : ""}
              </Typography>
            </Box>
          </Box>
          <IconButton
            onClick={() => setOpen(false)}
            sx={{
              color: "white",
              border: "2px solid rgba(255,255,255,0.6)",
              borderRadius: "50%",
              width: 38,
              height: 38,
              padding: 0,
              "&:hover": {
                backgroundColor: "rgba(255,255,255,0.2)",
                border: "2px solid white",
              },
            }}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ px: 3, py: 2 }}>
          {loading ? (
            <Box display="flex" justifyContent="center" py={4}>
              <CircularProgress />
            </Box>
          ) : error && !logs.length ? (
            <Typography color="text.secondary" sx={{ py: 3, textAlign: "center" }}>
              {error}
            </Typography>
          ) : (
            <TableContainer
              component={Paper}
              sx={{ border: `1px solid ${borderColor}`, maxHeight: "55vh" }}
            >
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    {["Timestamp", "Actor", "Message"].map((header) => (
                      <TableCell
                        key={header}
                        sx={{
                          backgroundColor: headerColor,
                          color: "white",
                          fontWeight: "bold",
                          border: `1px solid ${borderColor}`,
                        }}
                      >
                        {header}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {logs.map((log, index) => (
                    <TableRow
                      key={log.log_key || `${log.timestamp}-${index}`}
                      sx={{
                        backgroundColor: index % 2 === 0 ? "#fff" : "#f5f5f5",
                      }}
                    >
                      <TableCell
                        sx={{
                          border: `1px solid ${borderColor}`,
                          whiteSpace: "nowrap",
                          verticalAlign: "top",
                        }}
                      >
                        {formatHistoryTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell
                        sx={{
                          border: `1px solid ${borderColor}`,
                          verticalAlign: "top",
                          fontWeight: 600,
                        }}
                      >
                        {log.email || "unknown"}
                      </TableCell>
                      <TableCell
                        sx={{
                          border: `1px solid ${borderColor}`,
                          whiteSpace: "pre-line",
                        }}
                      >
                        {log.message}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            color="error"
            variant="outlined"
            onClick={() => setOpen(false)}
            sx={{ textTransform: "none", fontWeight: 600 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default PrintingHistoryDialog;
export { PRINTING_APPLICANT_ACTION, PRINTING_STUDENT_ACTION };
