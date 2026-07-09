import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import {
    Box,
    Typography,
    TextField,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    Snackbar,
    Alert,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogContentText,
    DialogActions,
} from "@mui/material";
import API_BASE_URL from '../apiConfig';

const DEFAULT_WORKLOAD_COLOR = "#fde047";

const clampChannel = (value) => Math.max(0, Math.min(255, Number(value)));

const rgbToHex = (r, g, b) => {
    const toHex = (n) => clampChannel(n).toString(16).padStart(2, "0");
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const parseColorToHex = (input) => {
    if (!input || typeof input !== "string") return null;

    const trimmed = input.trim();
    const hexMatch = trimmed.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/);
    if (hexMatch) {
        let hex = hexMatch[1];
        if (hex.length === 3) {
            hex = hex.split("").map((char) => char + char).join("");
        }
        return `#${hex.toLowerCase()}`;
    }

    const rgbMatch = trimmed.match(
        /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0|1|0?\.\d+))?\s*\)$/i
    );
    if (rgbMatch) {
        return rgbToHex(rgbMatch[1], rgbMatch[2], rgbMatch[3]);
    }

    return null;
};

const isValidCssColor = (input) => {
    if (!input?.trim()) return false;
    if (parseColorToHex(input)) return true;

    const el = document.createElement("div");
    el.style.color = input.trim();
    return el.style.color !== "";
};

const normalizeColorForSave = (input) => {
    const trimmed = input.trim();
    return parseColorToHex(trimmed) || trimmed;
};

const WorkloadManagement = () => {
    const [workloads, setWorkloads] = useState([]);
    const [workloadDescription, setWorkloadDescription] = useState("");
    const [workloadCode, setWorkloadCode] = useState("");
    const [workloadColor, setWorkloadColor] = useState(DEFAULT_WORKLOAD_COLOR);
    const colorPickerRef = useRef(null);
    const [editId, setEditId] = useState(null);
    const [deleteModal, setDeleteModal] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [snackbar, setSnackbar] = useState({
        open: false,
        message: "",
        severity: "success",
    });

    const showSnackbar = (message, severity = "success") => {
        setSnackbar({
            open: true,
            message,
            severity,
        });
    };

    useEffect(() => {
        fetchWorkloads();
    }, []);

    const fetchWorkloads = async () => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/workload`);
            setWorkloads(res.data);
        } catch (err) {
            console.error(err);
        }
    };

    const handleSubmit = async () => {
        if (!workloadDescription.trim()) {
            return showSnackbar(
                "Workload description is required",
                "warning"
            );
        }

        if (workloadColor.trim() && !isValidCssColor(workloadColor)) {
            return showSnackbar(
                "Enter a valid HEX (#99ccff) or RGB (rgb(153, 204, 255)) color",
                "warning"
            );
        }

        const normalizedColor = normalizeColorForSave(workloadColor);

        try {
            if (editId) {
                await axios.put(
                    `${API_BASE_URL}/api/workload/${editId}`,
                    {
                        workloadDescription,
                        workloadCode,
                        workloadColor: normalizedColor,
                    }
                );

                showSnackbar(
                    "Workload updated successfully",
                    "success"
                );
            } else {
                await axios.post(
                    `${API_BASE_URL}/api/workload`,
                    {
                        workloadDescription,
                        workloadCode,
                        workloadColor: normalizedColor,
                    }
                );

                showSnackbar(
                    "Workload added successfully",
                    "success"
                );
            }

            setWorkloadDescription("");
            setWorkloadCode("");
            setWorkloadColor(DEFAULT_WORKLOAD_COLOR);
            setEditId(null);
            fetchWorkloads();
        } catch (err) {
            console.error(err);

            showSnackbar(
                "Something went wrong",
                "error"
            );
        }
    };

    const handleEdit = (row) => {
        setEditId(row.id);
        setWorkloadDescription(row.workload_description);
        setWorkloadCode(row.workload_code || "");
        setWorkloadColor(row.workload_color || DEFAULT_WORKLOAD_COLOR);
    };

    const handleDeleteClick = (id) => {
        setSelectedId(id);
        setDeleteModal(true);
    };

    const confirmDelete = async () => {
        try {
            await axios.delete(
                `${API_BASE_URL}/api/workload/${selectedId}`
            );

            showSnackbar(
                "Workload deleted successfully",
                "success"
            );

            fetchWorkloads();
        } catch (err) {
            console.error(err);

            showSnackbar(
                "Failed to delete workload",
                "error"
            );
        } finally {
            setDeleteModal(false);
            setSelectedId(null);
        }
    };

    // 🔒 Disable right-click
    document.addEventListener("contextmenu", (e) => e.preventDefault());

    // 🔒 Block DevTools shortcuts + Ctrl+P silently
    document.addEventListener("keydown", (e) => {
        const isBlockedKey =
            e.key === "F12" ||
            e.key === "F11" ||
            (e.ctrlKey &&
                e.shiftKey &&
                (e.key.toLowerCase() === "i" || e.key.toLowerCase() === "j")) ||
            (e.ctrlKey && e.key.toLowerCase() === "u") ||
            (e.ctrlKey && e.key.toLowerCase() === "p");

        if (isBlockedKey) {
            e.preventDefault();
            e.stopPropagation();
        }
    });

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
                Workload Management
            </Typography>

            <Box
                sx={{
                    display: "flex",
                    gap: 2,
                    mb: 3,
                }}
            >
                <TextField
                    fullWidth
                    label="Workload Description"
                    value={workloadDescription}
                    onChange={(e) => setWorkloadDescription(e.target.value)}
                />

                <TextField
                    fullWidth
                    label="Workload Code"
                    value={workloadCode}
                    onChange={(e) => setWorkloadCode(e.target.value)}
                />

                <Box
                    sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 1.5,
                        minWidth: 280,
                        flexShrink: 0,
                    }}
                >
                    <Box
                        onClick={() => colorPickerRef.current?.click()}
                        sx={{
                            position: "relative",
                            width: 44,
                            height: 44,
                            mt: 1,
                            borderRadius: 1,
                            border: "1px solid #ccc",
                            backgroundColor: isValidCssColor(workloadColor)
                                ? workloadColor
                                : "#ffffff",
                            cursor: "pointer",
                            flexShrink: 0,
                            overflow: "hidden",
                            "&:hover": {
                                boxShadow: "0 0 0 2px rgba(25, 118, 210, 0.35)",
                            },
                        }}
                    >
                        <input
                            ref={colorPickerRef}
                            type="color"
                            value={parseColorToHex(workloadColor) || DEFAULT_WORKLOAD_COLOR}
                            onChange={(e) => setWorkloadColor(e.target.value)}
                            style={{
                                opacity: 0,
                                width: 0,
                                height: 0,
                                position: "absolute",
                            }}
                        />
                    </Box>

                    <TextField
                        label="Color"
                        placeholder="#99ccff or rgb(153, 204, 255)"
                        value={workloadColor}
                        onChange={(e) => setWorkloadColor(e.target.value)}
                        error={Boolean(workloadColor.trim()) && !isValidCssColor(workloadColor)}
                        helperText={
                            workloadColor.trim() && !isValidCssColor(workloadColor)
                                ? "Use HEX or RGB"
                                : "HEX, RGB, or pick a color"
                        }
                        sx={{ minWidth: 220 }}
                    />
                </Box>

                <Button
                    variant="contained"
                    onClick={handleSubmit}
                >
                    {editId ? "Update" : "Add"}
                </Button>
            </Box>

            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>ID</TableCell>
                            <TableCell>Workload Description</TableCell>
                            <TableCell>Workload Code</TableCell>
                            <TableCell>Color</TableCell>
                            <TableCell align="center">Actions</TableCell>
                        </TableRow>
                    </TableHead>

                    <TableBody>
                        {workloads.length > 0 ? (
                            workloads.map((row) => (
                                <TableRow key={row.id}>
                                    <TableCell>{row.id}</TableCell>
                                    <TableCell>{row.workload_description}</TableCell>
                                    <TableCell>{row.workload_code}</TableCell>
                                    <TableCell>
                                        <Box
                                            sx={{
                                                width: 28,
                                                height: 28,
                                                borderRadius: 1,
                                                border: "1px solid #ccc",
                                                backgroundColor:
                                                    row.workload_color || DEFAULT_WORKLOAD_COLOR,
                                            }}
                                        />
                                    </TableCell>

                                    <TableCell align="center">
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            sx={{ mr: 1 }}
                                            onClick={() => handleEdit(row)}
                                        >
                                            Edit
                                        </Button>

                                        <Button
                                            variant="contained"
                                            color="error"
                                            size="small"
                                            onClick={() => handleDeleteClick(row.id)}
                                        >
                                            Delete
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        ) : (
                            <TableRow>
                                <TableCell colSpan={5} align="center">
                                    No records found
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
            <Snackbar
                open={snackbar.open}
                autoHideDuration={3000}
                onClose={() =>
                    setSnackbar((prev) => ({
                        ...prev,
                        open: false,
                    }))
                }
                anchorOrigin={{
                    vertical: "top",
                    horizontal: "right",
                }}
            >
                <Alert
                    severity={snackbar.severity}
                    variant="filled"
                    onClose={() =>
                        setSnackbar((prev) => ({
                            ...prev,
                            open: false,
                        }))
                    }
                >
                    {snackbar.message}
                </Alert>
            </Snackbar>

            <Dialog
                open={deleteModal}
                onClose={() => setDeleteModal(false)}
            >
                <DialogTitle>
                    Confirm Deletion
                </DialogTitle>

                <DialogContent>
                    <DialogContentText>
                        Are you sure you want to delete this
                        workload record?
                    </DialogContentText>
                </DialogContent>

                <DialogActions>
                    <Button
                        onClick={() => setDeleteModal(false)}
                    >
                        Cancel
                    </Button>

                    <Button
                        color="error"
                        variant="contained"
                        onClick={confirmDelete}
                    >
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default WorkloadManagement;  