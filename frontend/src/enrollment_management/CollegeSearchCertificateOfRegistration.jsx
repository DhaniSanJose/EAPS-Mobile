import React, { useState, useEffect, useContext, useRef } from "react";
import { SettingsContext } from "../App";
import axios from "axios";
import {
    Box,
    Card,
    TextField,
    Typography,
    Table,
    TableHead,
    TableCell,
    TableRow,
    TableContainer,
    Paper,
    Snackbar,
    Alert,
    Chip,
} from "@mui/material";
import '../styles/Print.css'
import CertificateOfRegistrationForCollege from "./CollegeCertificateOfRegistration";
import EaristLogo from "../assets/EaristLogo.png";
import SearchIcon from "@mui/icons-material/Search";
import SchoolIcon from '@mui/icons-material/School';
import AssignmentIcon from '@mui/icons-material/Assignment';
import DashboardIcon from '@mui/icons-material/Dashboard';
import AssignmentTurnedInIcon from "@mui/icons-material/AssignmentTurnedIn";
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ScoreIcon from '@mui/icons-material/Score';
import { FcPrint } from "react-icons/fc";
import { useLocation, useNavigate } from "react-router-dom";
import API_BASE_URL from "../apiConfig";
import Unauthorized from "../components/Unauthorized";
import LoadingOverlay from "../components/LoadingOverlay"
import StudentHistoryDialog from "../components/StudentHistoryDialog";
import ListAltIcon from "@mui/icons-material/ListAlt";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import UploadFileIcon from "@mui/icons-material/UploadFile";
import {
    getDepartmentIdsFromAdminData,
    refreshRegistrarCurriculumId,
    resolveStudentRegistrarScope,
    restrictDepartmentsToScope,
    syncRegistrarScopeFromAdminData,
} from "../utils/registrarCurriculumRestriction";
import useRegistrarScopeRevision from "../hooks/useRegistrarScopeRevision";
import PersonSearchIcon from "@mui/icons-material/PersonSearch";
import PersonIcon from "@mui/icons-material/Person";
import { postAuditEvent } from "../utils/auditEvents";
import useAuditMac from "../utils/useAuditMac";

const cleanAuditValue = (value) => {
    if (value === null || value === undefined) return "";
    const text = String(value).trim();
    return ["null", "undefined"].includes(text.toLowerCase()) ? "" : text;
};

const formatStudentAuditName = (student) =>
    [
        cleanAuditValue(student?.first_name),
        cleanAuditValue(student?.middle_name),
        cleanAuditValue(student?.last_name),
    ].filter(Boolean).join(" ") || "Unknown Student";

const logCorSearchAudit = async (student, fallbackStudentNumber) => {
    try {
        await postAuditEvent("student_cor_searched", {
            student_name: formatStudentAuditName(student),
            student_number: cleanAuditValue(student?.student_number) || cleanAuditValue(fallbackStudentNumber) || "N/A",
        });
    } catch (err) {
        console.error("COR search audit failed:", err);
    }
};

const SearchCorForCollege = () => {
    useAuditMac();
    const settings = useContext(SettingsContext);

    const [titleColor, setTitleColor] = useState("#000000");
    const [subtitleColor, setSubtitleColor] = useState("#555555");
    const [borderColor, setBorderColor] = useState("#000000");
    const [mainButtonColor, setMainButtonColor] = useState("#1976d2");
    const [subButtonColor, setSubButtonColor] = useState("#ffffff");   // ✅ NEW
    const [stepperColor, setStepperColor] = useState("#000000");       // ✅ NEW

    const [fetchedLogo, setFetchedLogo] = useState(null);
    const [companyName, setCompanyName] = useState("");
    const [shortTerm, setShortTerm] = useState("");
    const [campusAddress, setCampusAddress] = useState("");

    useEffect(() => {
        if (!settings) return;

        // 🎨 Colors
        if (settings.title_color) setTitleColor(settings.title_color);
        if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
        if (settings.border_color) setBorderColor(settings.border_color);
        if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
        if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);   // ✅ NEW
        if (settings.stepper_color) setStepperColor(settings.stepper_color);           // ✅ NEW

        // 🏫 Logo
        if (settings.logo_url) {
            setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
        } else {
            setFetchedLogo(EaristLogo);
        }

        // 🏷️ School Information
        if (settings.company_name) setCompanyName(settings.company_name);
        if (settings.short_term) setShortTerm(settings.short_term);
        if (settings.campus_address) setCampusAddress(settings.campus_address);

    }, [settings]);

    // Also put it at the very top
    const [userID, setUserID] = useState("");
    const [user, setUser] = useState("");
    const [userRole, setUserRole] = useState("");

    const [hasAccess, setHasAccess] = useState(null);
    const [loading, setLoading] = useState(false);
    const pageId = 125;

    const [employeeID, setEmployeeID] = useState("");
    const [dprtmntID, setDepartmentID] = useState("");
    const [departments, setDepartments] = useState([]);
    const [departmentLoading, setDepartmentLoading] = useState(true);
    const [activeSchoolYearId, setActiveSchoolYearId] = useState(null);
    const scopeRevision = useRegistrarScopeRevision();

    useEffect(() => {
        if (userRole !== "registrar" || !employeeID) return;
        refreshRegistrarCurriculumId(employeeID).catch((err) => {
            console.error("Error refreshing registrar scope:", err);
        });
    }, [userRole, employeeID]);

    useEffect(() => {
        axios
            .get(`${API_BASE_URL}/api/get_active_school_years`)
            .then((res) => {
                if (Array.isArray(res.data) && res.data.length > 0) {
                    setActiveSchoolYearId(res.data[0].id);
                }
            })
            .catch((err) => console.error(err));
    }, []);

    useEffect(() => {
        const storedUser = localStorage.getItem("email");
        const storedRole = localStorage.getItem("role");
        const storedID = localStorage.getItem("person_id");
        const storedEmployeeID = localStorage.getItem("employee_id");

        if (storedUser && storedRole && storedID) {
            setUser(storedUser);
            setUserRole(storedRole);
            setUserID(storedID);
            setEmployeeID(storedEmployeeID);

            if (storedRole === "registrar") {
                checkAccess(storedEmployeeID);
            } else {
                window.location.href = "/login";
            }
        } else {
            window.location.href = "/login";
        }
    }, []);

    useEffect(() => {
        const email = localStorage.getItem("email");
        if (!email) {
            setDepartmentLoading(false);
            return;
        }

        const loadDepartments = async () => {
            try {
                const res = await axios.get(`${API_BASE_URL}/api/admin_data/${email}`);
                syncRegistrarScopeFromAdminData(res.data);
                const departmentIds = getDepartmentIdsFromAdminData(res.data);

                if (!departmentIds.length) {
                    setDepartments([]);
                    setDepartmentID("");
                    return;
                }

                const responses = await Promise.all(
                    departmentIds.map((departmentId) =>
                        axios.get(`${API_BASE_URL}/api/departments/${departmentId}`),
                    ),
                );
                const mergedDepartments = restrictDepartmentsToScope(
                    responses.flatMap((response) => response.data || []),
                );
                const uniqueDepartments = [
                    ...new Map(
                        mergedDepartments.map((dep) => [String(dep.dprtmnt_id), dep]),
                    ).values(),
                ];

                setDepartments(uniqueDepartments);
            } catch (err) {
                console.error("Failed to fetch admin data:", err);
            } finally {
                setDepartmentLoading(false);
            }
        };

        loadDepartments();
    }, [scopeRevision]);

    const checkAccess = async (employeeID) => {
        try {
            const response = await axios.get(`${API_BASE_URL}/api/page_access/${employeeID}/${pageId}`);
            if (response.data && response.data.page_privilege === 1) {
                setHasAccess(true);
            } else {
                setHasAccess(false);
            }
        } catch (error) {
            console.error('Error checking access:', error);
            setHasAccess(false);
            if (error.response && error.response.data.message) {
                console.log(error.response.data.message);
            } else {
                console.log("An unexpected error occurred.");
            }
            setLoading(false);
        }
    };

    const navigate = useNavigate();
    const location = useLocation();
    const isTabNavigationRef = useRef(false);
    const COLLEGE_COR_SEARCH_KEY = "college_cor_search_student_number";

    const tabs = [
        { label: "Student List", to: "/college_student_list", icon: <SchoolIcon fontSize="large" /> },
        { label: "Student Profile", to: "/student_college_personal_information", icon: <PersonIcon fontSize="large" /> },
        { label: "Student Online Requirements", to: "/student_online_requirements_college", icon: <AssignmentIcon fontSize="large" /> },
        { label: "Course Tagging", to: "/college_course_tagging", icon: <UploadFileIcon fontSize="large" /> },
        { label: "Search COR", to: "/college_search_certification_of_registration", icon: <MenuBookIcon fontSize="large" /> },
        { label: "Class List", to: "/college_class_list", icon: <PersonSearchIcon fontSize="large" /> },

    ];
    
    const [activeStep, setActiveStep] = useState(4);

    const handleStepClick = (index, to) => {
        setActiveStep(index);
        isTabNavigationRef.current = true;
        const params = new URLSearchParams(location.search);
        const pid =
            params.get("person_id") ||
            sessionStorage.getItem("edit_person_id") ||
            sessionStorage.getItem("admin_edit_person_id");
        const trimmed = studentNumber.trim();
        if (trimmed) {
            sessionStorage.setItem(COLLEGE_COR_SEARCH_KEY, trimmed);
            sessionStorage.setItem("edit_student_number", trimmed);
        } else {
            sessionStorage.removeItem(COLLEGE_COR_SEARCH_KEY);
        }

        if (pid) {
            navigate(`${to}?person_id=${pid}`);
        } else if (trimmed) {
            navigate(`${to}?student_number=${trimmed}`);
        } else {
            navigate(to);
        }
    };

    const [studentNumber, setStudentNumber] = useState(() => {
        return sessionStorage.getItem(COLLEGE_COR_SEARCH_KEY) || localStorage.getItem("studentNumberForCOR") || "";
    });
    const [debouncedStudentNumber, setDebouncedStudentNumber] = useState("");
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [studentData, setStudentData] = useState([]);
    const [studentDetails, setStudentDetails] = useState([]);
    const [corPreload, setCorPreload] = useState(null);
    const [corPreloadLoading, setCorPreloadLoading] = useState(false);
    const [openSnackbar, setOpenSnackbar] = useState(false);
    const [snackbarMessage, setSnackbarMessage] = useState("");
    const [snackbarSeverity, setSnackbarSeverity] = useState("info");

    const showSnackbar = (message, severity = "info") => {
        setSnackbarMessage(message);
        setSnackbarSeverity(severity);
        setOpenSnackbar(true);
    };

    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const studentNumberFromUrl = params.get("student_number")?.trim();
        const personIdFromUrl = params.get("person_id")?.trim();

        if (studentNumberFromUrl) {
            setStudentNumber(studentNumberFromUrl);
            sessionStorage.setItem(COLLEGE_COR_SEARCH_KEY, studentNumberFromUrl);
            sessionStorage.setItem("edit_student_number", studentNumberFromUrl);
            return;
        }

        if (!personIdFromUrl) return;

        setStudentNumber("");
        setDebouncedStudentNumber("");
        setSelectedStudent(null);
        setStudentData([]);
        setStudentDetails([]);
        setCorPreload(null);

        axios
            .get(`${API_BASE_URL}/api/student-person-data/${personIdFromUrl}`)
            .then((res) => {
                const resolvedStudentNumber = res.data?.student_number;
                if (resolvedStudentNumber) {
                    setStudentNumber(resolvedStudentNumber);
                    sessionStorage.setItem("edit_person_id", personIdFromUrl);
                    sessionStorage.setItem("edit_student_number", resolvedStudentNumber);
                    sessionStorage.setItem(COLLEGE_COR_SEARCH_KEY, resolvedStudentNumber);
                } else {
                    showSnackbar("No student number found for the selected person.", "warning");
                }
            })
            .catch((err) => {
                console.error("Auto COR search failed:", err);
                showSnackbar("Unable to load student number for the selected person.", "error");
            });
    }, [location.search]);

    const handleCloseSnackbar = (_, reason) => {
        if (reason === "clickaway") return;
        setOpenSnackbar(false);
    };

    useEffect(() => {
        if (!debouncedStudentNumber || debouncedStudentNumber.length < 5) {
            setSelectedStudent(null);
            setStudentData([]);
            setCorPreload(null);
            setCorPreloadLoading(false);
            return;
        }

        if (departmentLoading) {
            return;
        }

        const fetchStudent = async () => {
            try {
                setCorPreloadLoading(true);

                const [evalRes, scopeResult] = await Promise.all([
                    fetch(`${API_BASE_URL}/api/program_evaluation/${debouncedStudentNumber}`),
                    resolveStudentRegistrarScope(debouncedStudentNumber, {
                        activeSchoolYearId: activeSchoolYearId || undefined,
                    }),
                ]);

                if (scopeResult.error) {
                    setSelectedStudent(null);
                    setStudentData([]);
                    setStudentDetails([]);
                    setCorPreload(null);
                    showSnackbar(scopeResult.error, "error");
                    return;
                }

                const preloadData = scopeResult.preload;
                if (scopeResult.dprtmntId) {
                    setDepartmentID((prev) =>
                        String(prev) === String(scopeResult.dprtmntId)
                            ? prev
                            : scopeResult.dprtmntId,
                    );
                }
                setCorPreload(preloadData);

                if (!evalRes.ok) {
                    const errorBody = await evalRes.json().catch(() => null);
                    setSelectedStudent(null);
                    setStudentData([]);
                    setStudentDetails([]);
                    showSnackbar(
                        errorBody?.message ||
                            "No enrolled-subject summary found. COR can still be generated from student record.",
                        "info",
                    );
                    return;
                }

                const data = await evalRes.json();

                console.log("Fetched student data:", data);
                if (data) {
                    setSelectedStudent(data);
                    setStudentData(data);
                    await logCorSearchAudit(data, debouncedStudentNumber);
                    showSnackbar("Student found successfully.", "success");

                    const detailsRes = await fetch(`${API_BASE_URL}/api/program_evaluation/details/${debouncedStudentNumber}`);
                    const detailsData = await detailsRes.json();
                    if (Array.isArray(detailsData) && detailsData.length > 0) {
                        setStudentDetails(detailsData);
                    } else {
                        setStudentDetails([]);
                        showSnackbar("No enrolled subjects found for this student.", "info");
                    }
                } else {
                    setSelectedStudent(null);
                    setStudentData([]);
                    setStudentDetails([]);
                    setCorPreload(null);
                    showSnackbar("No student data found.", "info");
                }
            } catch (err) {
                console.error("Error fetching student", err);
                setCorPreload(null);
                showSnackbar("Server error. Please try again.", "error");
            } finally {
                setCorPreloadLoading(false);
            }
        };

        fetchStudent();
    }, [debouncedStudentNumber, departmentLoading, activeSchoolYearId]);

    const divToPrintRef = useRef();
    const [pdfLoading, setPdfLoading] = useState(false);

    const handleGeneratePdf = async () => {
        if (!divToPrintRef.current || pdfLoading) return;

        setPdfLoading(true);

        try {
            const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8" />
          <title>Certificate of Registration</title>
          <style>
            body {
              margin: 0;
              padding: 20px;
              font-family: Arial;
            }
          </style>
        </head>
        <body>
          ${divToPrintRef.current.innerHTML}
        </body>
      </html>
    `;

            const res = await fetch(`${API_BASE_URL}/api/generate-cor-pdf`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ html }),
            });

            const contentType = res.headers.get("content-type");

            if (!res.ok) {
                const errorData = await res.json().catch(() => null);
                console.error("Backend error:", errorData);
                throw new Error(errorData?.error || "PDF failed");
            }

            if (!contentType || !contentType.includes("application/pdf")) {
                const text = await res.text();
                console.error("Unexpected response:", text);
                throw new Error("Server did not return a valid PDF");
            }

            const blob = await res.blob();

            if (blob.size === 0) {
                throw new Error("Generated PDF is empty");
            }

            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "certificate_of_registration.pdf";
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error("Generate PDF error:", err);
            alert(err.message || "PDF failed");
        } finally {
            setPdfLoading(false);
        }
    };


    useEffect(() => {
        const trimmed = studentNumber.trim();
        const len = trimmed.length;

        if (len < 5) {
            setDebouncedStudentNumber("");
            return;
        }

        let delay = 500;
        if (len === 5) delay = 3000;
        else if (len === 6) delay = 2000;
        else if (len === 7) delay = 1000;
        else if (len >= 8 && len <= 10) delay = 500;

        const delayDebounce = setTimeout(() => {
            setDebouncedStudentNumber(trimmed);
        }, delay);

        return () => clearTimeout(delayDebounce);
    }, [studentNumber]);

    useEffect(() => {
        if (studentNumber) {
            localStorage.removeItem("studentNumberForCOR");
        }
    }, [studentNumber]);

    useEffect(() => {
        const handleBeforeUnload = () => {
            sessionStorage.removeItem(COLLEGE_COR_SEARCH_KEY);
            localStorage.removeItem("studentNumberForCOR");
        };

        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => {
            window.removeEventListener("beforeunload", handleBeforeUnload);
            if (!isTabNavigationRef.current) {
                sessionStorage.removeItem(COLLEGE_COR_SEARCH_KEY);
                localStorage.removeItem("studentNumberForCOR");
            }
        };
    }, []);

    const detectedDepartment = departments.find(
        (dep) => String(dep.dprtmnt_id) === String(dprtmntID),
    );

    // Put this at the very bottom before the return 
    if (loading || hasAccess === null) {
        return <LoadingOverlay open={loading} message="Loading..." />;
    }

    if (!hasAccess) {
        return (
            <Unauthorized />
        );
    }

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
        <Box
            sx={{
                height: "calc(100vh - 150px)",
                overflowY: "auto",
                paddingRight: 1,
                backgroundColor: "transparent",
                mt: 1,
                padding: 2,
            }}
        >
            <Box
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                mb={2}
                gap={2}
                flexWrap="wrap"
            >
                <Typography variant="h4"
                    sx={{
                        fontWeight: 'bold',
                        color: titleColor,
                        fontSize: '36px',
                    }}
                >
                    SEARCH CERTIFICATE OF REGISTRATION
                </Typography>

                <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
                    <TextField
                        variant="outlined"
                        placeholder="Enter Student Number"
                        size="small"
                        value={studentNumber}
                        disabled={departmentLoading}
                        onChange={(e) => setStudentNumber(e.target.value)}
                        sx={{
                            width: 450,
                            backgroundColor: "#fff",
                            borderRadius: 1,
                            "& .MuiOutlinedInput-root": {
                                borderRadius: "10px",
                            },
                        }}
                        InputProps={{
                            startAdornment: <SearchIcon sx={{ mr: 1, color: "gray" }} />,
                        }}
                    />
                    <StudentHistoryDialog
                        studentNumber={debouncedStudentNumber || studentNumber}
                        buttonColor={mainButtonColor}
                        disabled={departmentLoading}
                    />
                </Box>
            </Box>

            <hr style={{ border: "1px solid #ccc", width: "100%" }} />

            <br />
            <br />

            <Box
                sx={{
                    display: "flex",
                    justifyContent: "space-between",
                    flexWrap: "nowrap", // ❌ prevent wrapping
                    width: "100%",

                    gap: 2,
                }}
            >
                {tabs.map((tab, index) => (
                    <Card
                        key={index}
                        onClick={() => handleStepClick(index, tab.to)}
                        sx={{
                            flex: `1 1 ${100 / tabs.length}%`, // evenly divide row
                            height: 135,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            borderRadius: 2,
                            border: `1px solid ${borderColor}`,
                            backgroundColor:
                                activeStep === index
                                    ? settings?.header_color || "#1976d2"
                                    : "#E8C999",
                            color: activeStep === index ? "#fff" : "#000",
                            boxShadow:
                                activeStep === index
                                    ? "0px 4px 10px rgba(0,0,0,0.3)"
                                    : "0px 2px 6px rgba(0,0,0,0.15)",
                            transition: "0.3s ease",
                            "&:hover": {
                                backgroundColor: activeStep === index ? "#000000" : "#f5d98f",
                            },
                        }}
                    >
                        <Box
                            sx={{
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                            }}
                        >
                            <Box sx={{ fontSize: 40, mb: 1 }}>{tab.icon}</Box>
                            <Typography
                                sx={{ fontSize: 14, fontWeight: "bold", textAlign: "center" }}
                            >
                                {tab.label}
                            </Typography>
                        </Box>
                    </Card>
                ))}
            </Box>

            <br />
            <br />


            <TableContainer component={Paper} sx={{ width: '100%' }}>
                <Table>
                    <TableHead sx={{ backgroundColor: settings?.header_color || "#1976d2", border: `1px solid ${borderColor}`, }}>
                        <TableRow>
                            {/* Left cell: Student Number */}
                            <TableCell sx={{ color: 'white', fontSize: '20px', fontFamily: "Poppins, sans-serif", border: 'none' }}>
                                Student Number:&nbsp;
                                <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: "normal", textDecoration: "underline" }}>
                                    {studentData.student_number || "N/A"}
                                </span>
                            </TableCell>

                            {/* Right cell: Student Name */}
                            <TableCell
                                align="right"
                                sx={{ color: 'white', fontSize: '20px', fontFamily: "Poppins, sans-serif", border: 'none' }}
                            >
                                Student Name:&nbsp;
                                <span style={{ fontFamily: "Poppins, sans-serif", fontWeight: "normal", textDecoration: "underline" }}>
                                    {studentData && studentData.last_name
                                        ? `${studentData.last_name.toUpperCase()}, ${studentData.first_name.toUpperCase()} ${studentData.middle_name.toUpperCase()}`
                                        : "N/A"}
                                </span>
                            </TableCell>
                        </TableRow>
                    </TableHead>
                </Table>
            </TableContainer>
            <br />

            <button
                onClick={handleGeneratePdf}
                style={{
                    marginBottom: "1rem",
                    padding: "10px 20px",
                    border: "2px solid black",
                    backgroundColor: "#f0f0f0",
                    color: "black",
                    borderRadius: "5px",
                    marginTop: "20px",
                    cursor: "pointer",
                    fontSize: "16px",
                    fontWeight: "bold",
                    transition: "background-color 0.3s, transform 0.2s",
                }}
                onMouseEnter={(e) => (e.target.style.backgroundColor = "#d3d3d3")}
                onMouseLeave={(e) => (e.target.style.backgroundColor = "#f0f0f0")}
                onMouseDown={(e) => (e.target.style.transform = "scale(0.95)")}
                onMouseUp={(e) => (e.target.style.transform = "scale(1)")}
            >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FcPrint size={20} />
                    Generate Certificate PDF
                </span>
            </button>

            <div
                ref={divToPrintRef}
                style={{
                    transform: "scale(0.9)",       // 👈 10% zoom out
                    transformOrigin: "top center", // keeps it centered
                }}
            >
                <CertificateOfRegistrationForCollege
                    student_number={debouncedStudentNumber}
                    dprtmnt_id={dprtmntID}
                    preload={corPreload}
                    onNotify={({ message, severity }) => showSnackbar(message, severity)}
                />
            </div>


            <Snackbar
                open={openSnackbar}
                autoHideDuration={4000}
                onClose={handleCloseSnackbar}
                anchorOrigin={{ vertical: "top", horizontal: "center" }}
            >
                <Alert onClose={handleCloseSnackbar} severity={snackbarSeverity} variant="filled">
                    {snackbarMessage}
                </Alert>
            </Snackbar>
        </Box>
    );
};

export default SearchCorForCollege;
