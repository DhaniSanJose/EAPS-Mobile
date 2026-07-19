import React, { useState, useEffect, useContext, useRef } from "react";
import axios from "axios";
import { Box, Container, Button, TextField, Typography } from "@mui/material";
import { SettingsContext } from "../App";
import { FcPrint } from "react-icons/fc";
import { useLocation } from "react-router-dom";
import Search from '@mui/icons-material/Search';
import SearchIcon from "@mui/icons-material/Search";
import API_BASE_URL from "../apiConfig";

const MedicalCertificate = () => {
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



    useEffect(() => {
        if (settings) {
            // ✅ load dynamic logo
            if (settings.logo_url) {
                setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
            } else {
                setFetchedLogo(EaristLogo);
            }

            // ✅ load dynamic name + address
            if (settings.company_name) setCompanyName(settings.company_name);
            if (settings.campus_address) setCampusAddress(settings.campus_address);
        }
    }, [settings]);



    const [studentNumber, setStudentNumber] = useState("");
    const [medicalData, setMedicalData] = useState(null);

    const [userID, setUserID] = useState("");
    const [user, setUser] = useState("");
    const [userRole, setUserRole] = useState("");
    const [person, setPerson] = useState({
        profile_img: "",
        campus: "",
        academicProgram: "",
        classifiedAs: "",
        program: "",
        program2: "",
        program3: "",
        yearLevel: "",
        last_name: "",
        first_name: "",
        middle_name: "",
        extension: "",
        nickname: "",
        height: "",
        weight: "",
        lrnNumber: "",
        gender: "",
        pwdType: "",
        pwdId: "",
        birthOfDate: "",
        age: "",
        birthPlace: "",
        languageDialectSpoken: "",
        citizenship: "",
        religion: "",
        civilStatus: "",
        tribeEthnicGroup: "",
        cellphoneNumber: "",
        emailAddress: "",
        telephoneNumber: "",
        facebookAccount: "",
        presentStreet: "",
        presentBarangay: "",
        presentZipCode: "",
        presentRegion: "",
        presentProvince: "",
        presentMunicipality: "",
        presentDswdHouseholdNumber: "",
        permanentStreet: "",
        permanentBarangay: "",
        permanentZipCode: "",
        permanentRegion: "",
        permanentProvince: "",
        permanentMunicipality: "",
        permanentDswdHouseholdNumber: "",
    });




    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const queryPersonId = queryParams.get("person_id");

    // do not alter
    useEffect(() => {
        const storedUser = localStorage.getItem("email");
        const storedRole = localStorage.getItem("role");
        const storedID = localStorage.getItem("person_id");
        const storedStudentNumber = localStorage.getItem("student_number");

        if (storedUser && storedRole && (storedStudentNumber || storedID)) {
            setUser(storedUser);
            setUserRole(storedRole);
            setUserID(storedStudentNumber || storedID);

            if (storedRole === "applicant" || storedRole === "registrar") {
                if (storedStudentNumber) {
                    fetchPersonBySearch(storedStudentNumber);
                } else {
                    fetchPersonBySearch(storedID);
                }
            } else {
                window.location.href = "/login";
            }
        } else {
            window.location.href = "/login";
        }
    }, []);

    const [shortDate, setShortDate] = useState("");
    const [longDate, setLongDate] = useState("");

    useEffect(() => {
        const updateDates = () => {
            const now = new Date();

            // Format 1: MM/DD/YYYY
            const formattedShort = `${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")}/${now.getFullYear()}`;
            setShortDate(formattedShort);

            // Format 2: MM DD, YYYY hh:mm:ss AM/PM
            const day = String(now.getDate()).padStart(2, "0");
            const month = String(now.getMonth() + 1).padStart(2, "0");
            const year = now.getFullYear();
            const hours = String(now.getHours() % 12 || 12).padStart(2, "0");
            const minutes = String(now.getMinutes()).padStart(2, "0");
            const seconds = String(now.getSeconds()).padStart(2, "0");
            const ampm = now.getHours() >= 12 ? "PM" : "AM";

            const formattedLong = `${month} ${day}, ${year} ${hours}:${minutes}:${seconds} ${ampm}`;
            setLongDate(formattedLong);
        };

        updateDates(); // Set initial values
        const interval = setInterval(updateDates, 1000); // Update every second

        return () => clearInterval(interval); // Cleanup on unmount
    }, []);

    const divToPrintRef = useRef();


    const handleExportMedicalCertificatePdf = async () => {
        const logoSrc = fetchedLogo; // EaristLogo isn't imported here — remove or import it if you need a fallback

        const buildCertificateBlock = () => `
    <div
      class="student-table"
      style="display:flex; align-items:center; justify-content:center; padding:10px 10px; width:100%; box-sizing:border-box;"
    >
      <div style="display:flex; align-items:center;">
        <div style="flex-shrink:0; margin-right:20px;">
          <img
            src="${logoSrc}"
            alt="School Logo"
            style="width:120px; height:120px; border-radius:50%; object-fit:cover; margin-top:-30px;"
          />
        </div>
        <div>
          <div style="font-size:13px; font-family:Arial; text-align:left; margin-bottom:5px;">
            Republic of the Philippines
          </div>
          <div style="font-size:25px; font-weight:bold; color:black; font-family:Arial; margin-bottom:5px;">
            ${companyName}
          </div>
          <div style="display:flex; justify-content:center; margin-bottom:5px;">
            <hr style="width:100%; max-width:700px; border:1px solid #000; margin:0;" />
          </div>
          <br />
          <div style="text-align:center; font-size:16px; font-weight:bold; font-family:Arial; margin-left:-95px; margin-top:-20px;">
            HEALTH SERVICE DIVISION
          </div>
          <div style="text-align:center; font-size:16px; font-weight:bold; font-family:Arial; margin-left:-100px; margin-top:30px;">
            MEDICAL CERTIFICATE
          </div>
        </div>
      </div>
    </div>

    <table style="border-collapse:collapse; width:8in; margin:0 auto; font-family:Arial; font-size:16px; line-height:1.3;">
      <tbody>
        <tr>
          <td colspan="40" style="text-align:left; padding-bottom:5px; font-weight:bold;">
            TO WHOM IT MAY CONCERN:
          </td>
        </tr>

        <tr>
          <td colspan="40" style="text-align:justify; padding-bottom:10px; width:100%; white-space:nowrap; vertical-align:top;">
            This is to certify that&nbsp;
            <span style="display:inline-flex; flex-direction:column; align-items:center; width:50%; border-bottom:1px solid black; text-align:center;">
              <span>${(person.last_name || "").toUpperCase()}, ${(person.first_name || "").toUpperCase()} ${(person.middle_name || "").toUpperCase()}</span>
            </span>
            &nbsp;
            <span style="display:inline-flex; flex-direction:column; align-items:center; width:10%; border-bottom:1px solid black; text-align:center; margin-left:5px; margin-right:5px;">
              <span>${person.age || ""}</span>
            </span>
            &nbsp;years old,&nbsp;
            <span style="display:inline-flex; flex-direction:column; align-items:center; width:15%; border-bottom:1px solid black; text-align:center;">
              <span>${person.gender === 0 ? "MALE" : person.gender === 1 ? "FEMALE" : ""}</span>
            </span>
            <div style="display:flex; justify-content:space-between; margin-left:140px;">
              <span style="width:15%; text-align:center; margin-left:150px;">(Name)</span>
              <span style="width:20%; text-align:center; margin-left:30px;">(Age)</span>
              <span style="width:10%; text-align:center; margin-right:10px;">(Sex)</span>
            </div>
          </td>
        </tr>

        <tr>
          <td colspan="40" style="text-align:justify; padding-bottom:3px; width:100%; white-space:nowrap;">
            <span style="display:inline-block; text-align:center; width:10%; vertical-align:top;">
              <div style="border-bottom:1px solid black; width:100%; text-align:center;">${person.civilStatus || ""}</div>
              <div style="font-size:13px; text-align:center;">(Civil Status)</div>
            </span>
            &nbsp;A resident of&nbsp;
            <span style="display:inline-block; text-align:center; width:50%; vertical-align:top;">
              <div style="border-bottom:1px solid black; width:100%; text-align:center;">
                ${person.permanentStreet || ""} ${person.permanentBarangay || ""} ${person.permanentMunicipality || ""}
              </div>
              <div style="font-size:13px; text-align:center;">(Address)</div>
            </span>
            &nbsp;was examined on&nbsp;
            <span style="display:inline-block; text-align:center; width:16%; vertical-align:bottom; white-space:nowrap;">
              <div style="border-bottom:1px solid black; text-align:center; width:100%; line-height:16px;"></div>
              <div style="font-size:13px; text-align:center; margin-top:1px; line-height:14px;">(Date)</div>
            </span>
          </td>
        </tr>

        <tr>
          <td colspan="40" style="text-align:left; padding-top:6px; width:100%;">
            <div style="display:flex; align-items:center; justify-content:flex-start; width:101.5%;">
              <span style="min-width:60px;">Due to:</span>
              <span style="flex-grow:1; border-bottom:1px solid black; display:inline-block; margin-left:5px;"></span>
            </div>
          </td>
        </tr>

        <tr>
          <td colspan="40" style="text-align:left; padding-top:5px; width:100%; font-size:14px; line-height:1.8;">
            And found:
            <br />
            <div style="margin-left:50px; margin-top:-20px;">
              <br />
              ( ) Physically and mentally fit.
              <br />
              ( ) With the impression of
              <span style="display:inline-block; border-bottom:1px solid black; width:300px; margin-left:5px;"></span>
              <br />
              And was advised to
              <span style="display:inline-block; border-bottom:1px solid black; width:335px; margin-left:5px;"></span>
              <br />
              <br />
              This certificate is issued upon request for medical purposes only.
            </div>
            <br />
            Official Receipt No.:
            <span style="display:inline-block; border-bottom:1px solid black; width:200px; margin-left:5px;"></span>
            <br />
            Date Issued:
            <span style="display:inline-block; border-bottom:1px solid black; width:245px; margin-left:5px;"></span>
            <br />
            MC No.:
            <span style="display:inline-block; border-bottom:1px solid black; width:265px; margin-left:5px;"></span>
            <br />
            <div style="text-align:center; margin-top:15px; margin-bottom:10px;">
              <span style="display:inline-block; border-bottom:1px solid black; width:300px; margin-left:250px;"></span>
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  `;

        const innerHtml = `
    ${buildCertificateBlock()}
    <hr style="border:2px solid black; width:100%;" />
    ${buildCertificateBlock()}
  `;

        try {
            const response = await axios.post(
                `${API_BASE_URL}/api/generate-medical-certificate-pdf`,
                {
                    html: innerHtml,
                    student_number: userID,
                    last_name: person.last_name,
                    first_name: person.first_name,
                },
                {
                    responseType: "blob",
                },
            );

            const blobUrl = window.URL.createObjectURL(new Blob([response.data], { type: "application/pdf" }));
            const link = document.createElement("a");
            link.href = blobUrl;
            link.setAttribute(
                "download",
                `Medical_Certificate_${(person.last_name || "Student").replace(/\s+/g, "_")}.pdf`,
            );
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(blobUrl);
        } catch (err) {
            console.error("Failed to generate Medical Certificate PDF:", err);
            alert("Failed to generate Medical Certificate PDF.");
        }
    };


    const [curriculumOptions, setCurriculumOptions] = useState([]);

    useEffect(() => {
        const fetchCurriculums = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/api/applied_program`);
                setCurriculumOptions(response.data);
            } catch (error) {
                console.error("Error fetching curriculum options:", error);
            }
        };

        fetchCurriculums();
    }, []);

    {
        curriculumOptions.find(
            (item) =>
                item?.curriculum_id?.toString() === (person?.program ?? "").toString()
        )?.program_description || (person?.program ?? "")

    }

    const [searchQuery, setSearchQuery] = useState("");
    const [personResults, setPersonResults] = useState([]);
    const [searchError, setSearchError] = useState("");

    const fetchPersonBySearch = async (query) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/search-person-student`, {
                params: { query }
            });

            setPersonResults(res.data);
            if (res.data.length === 1) {
                setPerson(res.data[0]);
                fetchMedicalData(res.data[0].student_number);
            }
            console.log("✅ Person search results:", res.data);
        } catch (error) {
            console.error("❌ Failed to search person:", error);
            setPersonResults([]);
        }
    };

    const fetchMedicalData = async (studentNumber) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/medical-requirements/${studentNumber}`);
            setMedicalData(res.data);
            console.log("✅ Loaded medical data for:", studentNumber, res.data);
        } catch (err) {
            if (err.response?.status === 404) {
                console.warn(`ℹ️ No medical record found for ${studentNumber}`);
                setMedicalData(null);
            } else {
                console.error("❌ Failed to load medical data:", err);
            }
        }
    };

    useEffect(() => {
        const delayDebounce = setTimeout(async () => {
            if (searchQuery.trim() === "") return;

            try {
                const res = await axios.get(`${API_BASE_URL}/api/search-person-student`, {
                    params: { query: searchQuery }
                });

                console.log("Search result data:", res.data);
                setPerson(res.data);

                const idToStore = res.data.person_id || res.data.id;
                if (!idToStore) {
                    setSearchError("Invalid search result");
                    return;
                }

                sessionStorage.setItem("admin_edit_person_id", idToStore);
                sessionStorage.setItem("admin_edit_person_data", JSON.stringify(res.data));
                setUserID(idToStore);
                setSearchError("");
            } catch (err) {
                console.error("Search failed:", err);
                setSearchError("Applicant not found");
            }
        }, 500);

        return () => clearTimeout(delayDebounce);
    }, [searchQuery]);

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
        <Box sx={{ height: "calc(100vh - 150px)", overflowY: "auto", paddingRight: 1, backgroundColor: "transparent", mt: 1, padding: 2 }}>     {/* Header with Search aligned right */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',

                    mb: 2,

                }}
            >
                <Typography
                    variant="h4"
                    sx={{
                        fontWeight: "bold",
                        color: titleColor,
                        fontSize: "36px",
                    }}
                >
                    MEDICAL CERTIFICATE
                </Typography>

                <TextField
                    size="small"
                    placeholder="Search by Student Number / Name / Email"
                    value={searchQuery}

                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") fetchPersonBySearch(searchQuery);
                    }}
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

            </Box>


            <hr style={{ border: "1px solid #ccc", width: "100%" }} />


            <br />


            <button
                onClick={handleExportMedicalCertificatePdf}
                style={{
                    padding: "5px 20px",
                    border: "2px solid black",
                    backgroundColor: "#f0f0f0",
                    color: "black",
                    borderRadius: "5px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: "bold",
                    transition: "background-color 0.3s, transform 0.2s",
                    height: "40px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    userSelect: "none",
                }}
                onMouseEnter={(e) =>
                    (e.currentTarget.style.backgroundColor = "#d3d3d3")
                }
                onMouseLeave={(e) =>
                    (e.currentTarget.style.backgroundColor = "#f0f0f0")
                }
                onMouseDown={(e) =>
                    (e.currentTarget.style.transform = "scale(0.95)")
                }
                onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
                type="button"
            >
                <FcPrint size={20} />
                Download Medical Certificate
            </button>

            <Container>
                <div ref={divToPrintRef}>
                    <div>
                        <style>
                            {`
          @media print {
            button {
              display: none;
            }
          }
        `}
                        </style>


                    </div>

                    <Container>

                        <div
                            className="student-table"
                            style={{

                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center", // Center horizontally
                                padding: "10px 10px",
                                width: "100%",

                                boxSizing: "border-box"
                            }}>
                            {/* Wrapper to contain logo and text side by side without stretching */}
                            <div style={{
                                display: "flex",

                                alignItems: "center"
                            }}>
                                {/* Logo */}
                                <div style={{ flexShrink: 0, marginRight: "20px" }}>
                                    <img
                                        src={fetchedLogo}
                                        alt="School Logo"
                                        style={{
                                            width: "120px",   // ✅ hardcoded width
                                            height: "120px",  // ✅ hardcoded height
                                            borderRadius: "50%", // optional (use for circular look)
                                            objectFit: "cover",
                                            marginTop: "-30px",
                                        }}
                                    />
                                </div>


                                <div>
                                    {/* Top Line: Republic */}
                                    <div style={{
                                        fontSize: "13px",
                                        fontFamily: "Arial",
                                        textAlign: "left",
                                        marginBottom: "5px"
                                    }}>
                                        Republic of the Philippines
                                    </div>

                                    {/* Institute Name */}
                                    <div
                                        style={{
                                            fontSize: "25px",
                                            fontWeight: "bold",
                                            color: "black",
                                            fontFamily: "Arial",
                                            marginBottom: "5px",
                                        }}
                                    >
                                        {companyName}
                                    </div>

                                    {/* Horizontal Line */}
                                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "5px" }}>
                                        <hr style={{ width: "100%", maxWidth: "700px", border: "1px solid #000", margin: 0 }} />
                                    </div>
                                    <br />
                                    {/* Office Name */}
                                    <div style={{
                                        textAlign: "center",
                                        fontSize: "16px",
                                        fontWeight: "bold",
                                        fontFamily: "Arial",
                                        marginLeft: "-95px",
                                        marginTop: "-20px"
                                    }}>
                                        HEALTH SERVICE DIVISION

                                    </div>

                                    <div style={{
                                        textAlign: "center",
                                        fontSize: "16px",
                                        fontWeight: "bold",
                                        fontFamily: "Arial",
                                        marginLeft: "-100px",

                                        marginTop: "30px"
                                    }}>
                                        MEDICAL CERTIFICATE

                                    </div>
                                </div>
                            </div>
                        </div>

                        <table
                            style={{
                                borderCollapse: "collapse",
                                width: "8in",
                                margin: "0 auto",
                                fontFamily: "Arial",
                                fontSize: "16px",
                                lineHeight: "1.3",
                            }}
                        >
                            <tbody>
                                {/* Title */}

                                {/* Salutation */}
                                <tr>
                                    <td colSpan={40} style={{ textAlign: "left", paddingBottom: "5px", fontWeight: "bold" }}>
                                        TO WHOM IT MAY CONCERN:
                                    </td>
                                </tr>

                                {/* Certification Line */}
                                {/* Name, Age, Sex Line - Fully Fitted */}
                                <tr>
                                    <td
                                        colSpan={40}
                                        style={{
                                            textAlign: "justify",
                                            paddingBottom: "10px",
                                            width: "100%",
                                            whiteSpace: "nowrap",
                                            verticalAlign: "top",
                                        }}
                                    >
                                        This is to certify that&nbsp;
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                width: "50%",
                                                borderBottom: "1px solid black",
                                                textAlign: "center",
                                            }}
                                        >
                                            <span>
                                                {person.last_name.toUpperCase()}, {person.first_name.toUpperCase()}{" "}
                                                {person.middle_name.toUpperCase()}
                                            </span>

                                        </span>

                                        &nbsp;

                                        <span
                                            style={{
                                                display: "inline-flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                width: "10%",
                                                borderBottom: "1px solid black",
                                                textAlign: "center",
                                                marginLeft: "5px",
                                                marginRight: "5px",
                                            }}
                                        >
                                            <span>{person.age}</span>

                                        </span>
                                        &nbsp;years old,&nbsp;
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                width: "15%",
                                                borderBottom: "1px solid black",
                                                textAlign: "center",
                                            }}
                                        >
                                            <span>
                                                {person.gender === 0
                                                    ? "MALE"
                                                    : person.gender === 1
                                                        ? "FEMALE"
                                                        : ""}
                                            </span>

                                        </span>
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                marginLeft: "140px",
                                            }}
                                        >
                                            <span style={{ width: "15%", textAlign: "center", marginLeft: "150px" }}>(Name)</span>

                                            <span style={{ width: "20%", textAlign: "center", marginLeft: "30px" }}>(Age)</span>
                                            <span style={{ width: "10%", textAlign: "center", marginRight: "10px" }}>(Sex)</span>
                                        </div>
                                    </td>
                                </tr>


                                {/* Civil Status, Address, Date - All in One Row with Labels Below */}
                                <tr>
                                    <td
                                        colSpan={40}
                                        style={{
                                            textAlign: "justify",
                                            paddingBottom: "3px",
                                            width: "100%",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {/* Civil Status */}
                                        <span
                                            style={{
                                                display: "inline-block",
                                                textAlign: "center",
                                                width: "10%",
                                                verticalAlign: "top",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    borderBottom: "1px solid black",
                                                    width: "100%",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {person.civilStatus}
                                            </div>
                                            <div style={{ fontSize: "13px", textAlign: "center" }}>(Civil Status)</div>
                                        </span>

                                        &nbsp;A resident of&nbsp;

                                        {/* Address */}
                                        <span
                                            style={{
                                                display: "inline-block",
                                                textAlign: "center",
                                                width: "50%",
                                                verticalAlign: "top",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    borderBottom: "1px solid black",
                                                    width: "100%",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {person.permanentStreet} {person.permanentBarangay}{" "}
                                                {person.permanentMunicipality}
                                            </div>
                                            <div style={{ fontSize: "13px", textAlign: "center" }}>(Address)</div>
                                        </span>

                                        &nbsp;was examined on&nbsp;

                                        {/* Date */}
                                        <span
                                            style={{
                                                display: "inline-block",
                                                textAlign: "center",
                                                width: "16%",
                                                verticalAlign: "bottom",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    borderBottom: "1px solid black",
                                                    textAlign: "center",
                                                    width: "100%",
                                                    lineHeight: "16px",
                                                }}
                                            >
                                                {/* Insert date here */}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "13px",
                                                    textAlign: "center",
                                                    marginTop: "1px",
                                                    lineHeight: "14px",
                                                }}
                                            >
                                                (Date)
                                            </div>
                                        </span>
                                    </td>
                                </tr>

                                {/* ✅ Due to Line — perfectly matching width */}
                                <tr>
                                    <td
                                        colSpan={40}
                                        style={{
                                            textAlign: "left",
                                            paddingTop: "6px",
                                            width: "100%",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "flex-start",
                                                width: "101.5%",
                                            }}
                                        >
                                            <span style={{ minWidth: "60px" }}>Due to:</span>
                                            <span
                                                style={{
                                                    flexGrow: 1,
                                                    borderBottom: "1px solid black",
                                                    display: "inline-block",
                                                    marginLeft: "5px",
                                                }}
                                            ></span>
                                        </div>
                                    </td>
                                </tr>

                                {/* --- Findings and Footer Section --- */}
                                <tr>
                                    <td
                                        colSpan={40}
                                        style={{
                                            textAlign: "left",
                                            paddingTop: "5px",
                                            width: "100%",
                                            fontSize: "14px",
                                            lineHeight: "1.8",
                                        }}
                                    >
                                        And found:
                                        <br />
                                        <div style={{ marginLeft: "50px", marginTop: "-20px" }}>
                                            <br />
                                            ( ) Physically and mentally fit.
                                            <br />
                                            ( ) With the impression of{" "}
                                            <span
                                                style={{
                                                    display: "inline-block",
                                                    borderBottom: "1px solid black",
                                                    width: "300px", // uniform underline width
                                                    marginLeft: "5px",
                                                }}
                                            ></span>
                                            <br />
                                            And was advised to{" "}
                                            <span
                                                style={{
                                                    display: "inline-block",
                                                    borderBottom: "1px solid black",
                                                    width: "335px", // same width
                                                    marginLeft: "5px",
                                                }}
                                            ></span>

                                            <br />
                                            <br />
                                            This certificate is issued upon request for medical purposes only.
                                        </div>
                                        <br />
                                        Official Receipt No.:{" "}
                                        <span
                                            style={{
                                                display: "inline-block",
                                                borderBottom: "1px solid black",
                                                width: "200px",
                                                marginLeft: "5px",
                                            }}
                                        ></span>
                                        <br />
                                        Date Issued:{" "}
                                        <span
                                            style={{
                                                display: "inline-block",
                                                borderBottom: "1px solid black",
                                                width: "245px",
                                                marginLeft: "5px",
                                            }}
                                        ></span>
                                        <br />
                                        MC No.:{" "}
                                        <span
                                            style={{
                                                display: "inline-block",
                                                borderBottom: "1px solid black",
                                                width: "265px",
                                                marginLeft: "5px",
                                            }}
                                        ></span>
                                        <br />
                                        {/* --- Centered line below MC No. --- */}
                                        <div
                                            style={{
                                                textAlign: "center",
                                                marginTop: "15px",
                                                marginBottom: "10px"
                                            }}
                                        >
                                            <span
                                                style={{
                                                    display: "inline-block",
                                                    borderBottom: "1px solid black",
                                                    width: "300px",
                                                    marginLeft: "250px"
                                                }}
                                            ></span>
                                        </div>
                                    </td>
                                </tr>


                            </tbody>
                        </table>
                    </Container>

                    <hr style={{ border: "2px solid black", width: "100%" }} />

                    <Container>


                        <div
                            className="student-table"
                            style={{

                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center", // Center horizontally
                                padding: "10px 10px",
                                width: "100%",

                                boxSizing: "border-box"
                            }}>
                            {/* Wrapper to contain logo and text side by side without stretching */}
                            <div style={{
                                display: "flex",

                                alignItems: "center"
                            }}>
                                {/* Logo */}
                                <div style={{ flexShrink: 0, marginRight: "20px" }}>
                                    <img
                                        src={fetchedLogo}
                                        alt="School Logo"
                                        style={{
                                            width: "120px",   // ✅ hardcoded width
                                            height: "120px",  // ✅ hardcoded height
                                            borderRadius: "50%", // optional (use for circular look)
                                            objectFit: "cover",
                                            marginTop: "-30px",
                                        }}
                                    />
                                </div>



                                <div>
                                    {/* Top Line: Republic */}
                                    <div style={{
                                        fontSize: "13px",
                                        fontFamily: "Arial",
                                        textAlign: "left",
                                        marginBottom: "5px"
                                    }}>
                                        Republic of the Philippines
                                    </div>

                                    {/* Institute Name */}
                                    <div
                                        style={{
                                            fontSize: "25px",
                                            fontWeight: "bold",
                                            color: "black",
                                            fontFamily: "Arial",
                                            marginBottom: "5px",
                                        }}
                                    >
                                        {companyName}
                                    </div>

                                    {/* Horizontal Line */}
                                    <div style={{ display: "flex", justifyContent: "center", marginBottom: "5px" }}>
                                        <hr style={{ width: "100%", maxWidth: "700px", border: "1px solid #000", margin: 0 }} />
                                    </div>
                                    <br />
                                    {/* Office Name */}
                                    <div style={{
                                        textAlign: "center",
                                        fontSize: "16px",
                                        fontWeight: "bold",
                                        fontFamily: "Arial",
                                        marginLeft: "-85px",
                                        marginTop: "-20px"
                                    }}>
                                        HEALTH SERVICE DIVISION

                                    </div>

                                    <div style={{
                                        textAlign: "center",
                                        fontSize: "16px",
                                        fontWeight: "bold",
                                        fontFamily: "Arial",
                                        marginLeft: "-100px",

                                        marginTop: "30px"
                                    }}>
                                        MEDICAL CERTIFICATE

                                    </div>
                                </div>
                            </div>
                        </div>
                        <br />
                        <table
                            style={{
                                borderCollapse: "collapse",
                                width: "8in",
                                margin: "0 auto",
                                fontFamily: "Arial",
                                fontSize: "16px",
                                lineHeight: "1.3",
                            }}
                        >
                            <tbody>
                                {/* Title */}

                                {/* Salutation */}
                                <tr>
                                    <td colSpan={40} style={{ textAlign: "left", paddingBottom: "5px", fontWeight: "bold" }}>
                                        TO WHOM IT MAY CONCERN:
                                    </td>
                                </tr>

                                {/* Certification Line */}
                                {/* Name, Age, Sex Line - Fully Fitted */}
                                <tr>
                                    <td
                                        colSpan={40}
                                        style={{
                                            textAlign: "justify",
                                            paddingBottom: "10px",
                                            width: "100%",
                                            whiteSpace: "nowrap",
                                            verticalAlign: "top",
                                        }}
                                    >
                                        This is to certify that&nbsp;
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                width: "50%",
                                                borderBottom: "1px solid black",
                                                textAlign: "center",
                                            }}
                                        >
                                            <span>
                                                {person.last_name.toUpperCase()}, {person.first_name.toUpperCase()}{" "}
                                                {person.middle_name.toUpperCase()}
                                            </span>

                                        </span>

                                        &nbsp;

                                        <span
                                            style={{
                                                display: "inline-flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                width: "10%",
                                                borderBottom: "1px solid black",
                                                textAlign: "center",
                                                marginLeft: "5px",
                                                marginRight: "5px",
                                            }}
                                        >
                                            <span>{person.age}</span>

                                        </span>
                                        &nbsp;years old,&nbsp;
                                        <span
                                            style={{
                                                display: "inline-flex",
                                                flexDirection: "column",
                                                alignItems: "center",
                                                width: "15%",
                                                borderBottom: "1px solid black",
                                                textAlign: "center",
                                            }}
                                        >
                                            <span>
                                                {person.gender === 0
                                                    ? "MALE"
                                                    : person.gender === 1
                                                        ? "FEMALE"
                                                        : ""}
                                            </span>

                                        </span>
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "space-between",
                                                marginLeft: "140px",
                                            }}
                                        >
                                            <span style={{ width: "15%", textAlign: "center", marginLeft: "150px" }}>(Name)</span>

                                            <span style={{ width: "20%", textAlign: "center", marginLeft: "30px" }}>(Age)</span>
                                            <span style={{ width: "10%", textAlign: "center", marginRight: "10px" }}>(Sex)</span>
                                        </div>
                                    </td>
                                </tr>


                                {/* Civil Status, Address, Date - All in One Row with Labels Below */}
                                <tr>
                                    <td
                                        colSpan={40}
                                        style={{
                                            textAlign: "justify",
                                            paddingBottom: "3px",
                                            width: "100%",
                                            whiteSpace: "nowrap",
                                        }}
                                    >
                                        {/* Civil Status */}
                                        <span
                                            style={{
                                                display: "inline-block",
                                                textAlign: "center",
                                                width: "10%",
                                                verticalAlign: "top",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    borderBottom: "1px solid black",
                                                    width: "100%",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {person.civilStatus}
                                            </div>
                                            <div style={{ fontSize: "13px", textAlign: "center" }}>(Civil Status)</div>
                                        </span>

                                        &nbsp;A resident of&nbsp;

                                        {/* Address */}
                                        <span
                                            style={{
                                                display: "inline-block",
                                                textAlign: "center",
                                                width: "50%",
                                                verticalAlign: "top",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    borderBottom: "1px solid black",
                                                    width: "100%",
                                                    textAlign: "center",
                                                }}
                                            >
                                                {person.permanentStreet} {person.permanentBarangay}{" "}
                                                {person.permanentMunicipality}
                                            </div>
                                            <div style={{ fontSize: "13px", textAlign: "center" }}>(Address)</div>
                                        </span>

                                        &nbsp;was examined on&nbsp;

                                        {/* Date */}
                                        <span
                                            style={{
                                                display: "inline-block",
                                                textAlign: "center",
                                                width: "16%",
                                                verticalAlign: "bottom",
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            <div
                                                style={{
                                                    borderBottom: "1px solid black",
                                                    textAlign: "center",
                                                    width: "100%",
                                                    lineHeight: "16px",
                                                }}
                                            >
                                                {/* Insert date here */}
                                            </div>
                                            <div
                                                style={{
                                                    fontSize: "13px",
                                                    textAlign: "center",
                                                    marginTop: "1px",
                                                    lineHeight: "14px",
                                                }}
                                            >
                                                (Date)
                                            </div>
                                        </span>
                                    </td>
                                </tr>

                                {/* ✅ Due to Line — perfectly matching width */}
                                <tr>
                                    <td
                                        colSpan={40}
                                        style={{
                                            textAlign: "left",
                                            paddingTop: "6px",
                                            width: "100%",
                                        }}
                                    >
                                        <div
                                            style={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "flex-start",
                                                width: "101.5%",
                                            }}
                                        >
                                            <span style={{ minWidth: "60px" }}>Due to:</span>
                                            <span
                                                style={{
                                                    flexGrow: 1,
                                                    borderBottom: "1px solid black",
                                                    display: "inline-block",
                                                    marginLeft: "5px",
                                                }}
                                            ></span>
                                        </div>
                                    </td>
                                </tr>


                                {/* --- Findings and Footer Section --- */}
                                <tr>
                                    <td
                                        colSpan={40}
                                        style={{
                                            textAlign: "left",
                                            paddingTop: "5px",
                                            width: "100%",
                                            fontSize: "14px",
                                            lineHeight: "1.8",
                                        }}
                                    >
                                        And found:
                                        <br />
                                        <div style={{ marginLeft: "50px", marginTop: "-20px" }}>
                                            <br />
                                            ( ) Physically and mentally fit.
                                            <br />
                                            ( ) With the impression of{" "}
                                            <span
                                                style={{
                                                    display: "inline-block",
                                                    borderBottom: "1px solid black",
                                                    width: "300px", // uniform underline width
                                                    marginLeft: "5px",
                                                }}
                                            ></span>
                                            <br />
                                            And was advised to{" "}
                                            <span
                                                style={{
                                                    display: "inline-block",
                                                    borderBottom: "1px solid black",
                                                    width: "335px", // same width
                                                    marginLeft: "5px",
                                                }}
                                            ></span>

                                            <br />
                                            <br />
                                            This certificate is issued upon request for medical purposes only.
                                        </div>
                                        <br />
                                        Official Receipt No.:{" "}
                                        <span
                                            style={{
                                                display: "inline-block",
                                                borderBottom: "1px solid black",
                                                width: "200px",
                                                marginLeft: "5px",
                                            }}
                                        ></span>
                                        <br />
                                        Date Issued:{" "}
                                        <span
                                            style={{
                                                display: "inline-block",
                                                borderBottom: "1px solid black",
                                                width: "245px",
                                                marginLeft: "5px",
                                            }}
                                        ></span>
                                        <br />
                                        MC No.:{" "}
                                        <span
                                            style={{
                                                display: "inline-block",
                                                borderBottom: "1px solid black",
                                                width: "265px",
                                                marginLeft: "5px",
                                            }}
                                        ></span>
                                        <br />
                                        {/* --- Centered line below MC No. --- */}
                                        <div
                                            style={{
                                                textAlign: "center",
                                                marginTop: "15px",
                                                marginBottom: "10px"
                                            }}
                                        >
                                            <span
                                                style={{
                                                    display: "inline-block",
                                                    borderBottom: "1px solid black",
                                                    width: "300px",
                                                    marginLeft: "250px"
                                                }}
                                            ></span>
                                        </div>
                                    </td>
                                </tr>


                            </tbody>
                        </table>
                    </Container>
                </div>





            </Container>


        </Box >

    );
};

export default MedicalCertificate;


