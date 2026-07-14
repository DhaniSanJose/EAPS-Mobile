import React, { useState, useEffect, useContext, useRef, forwardRef, useImperativeHandle } from "react";

import { SettingsContext } from "../App";
import axios from "axios";
import { Box, Container, Typography } from "@mui/material";
import EaristLogo from "../assets/EaristLogo.png";
import { FcPrint } from "react-icons/fc";
import { useLocation } from "react-router-dom";
import API_BASE_URL from "../apiConfig";


const PersonalDataForm = forwardRef((props, ref) => {

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
    const [branches, setBranches] = useState([]);

    useEffect(() => {
        if (!settings) return;

        // 🎨 Colors
        if (settings.title_color) setTitleColor(settings.title_color);
        if (settings.subtitle_color) setSubtitleColor(settings.subtitle_color);
        if (settings.border_color) setBorderColor(settings.border_color);
        if (settings.main_button_color) setMainButtonColor(settings.main_button_color);
        if (settings.sub_button_color) setSubButtonColor(settings.sub_button_color);
        if (settings.stepper_color) setStepperColor(settings.stepper_color);

        // 🏫 Logo
        if (settings.logo_url) {
            setFetchedLogo(`${API_BASE_URL}${settings.logo_url}`);
        } else {
            setFetchedLogo(EaristLogo);
        }

        // 🏷️ School Info
        if (settings.company_name) setCompanyName(settings.company_name);
        if (settings.short_term) setShortTerm(settings.short_term);
        if (settings.campus_address) setCampusAddress(settings.campus_address);

        // ✅ Branches (JSON stored in DB)
        if (settings?.branches) {
            try {
                const parsed =
                    typeof settings.branches === "string"
                        ? JSON.parse(settings.branches)
                        : settings.branches;

                setBranches(parsed);
            } catch (err) {
                console.error("Failed to parse branches:", err);
                setBranches([]);
            }
        }


    }, [settings]);



    const [userID, setUserID] = useState("");
    const [user, setUser] = useState("");
    const [userRole, setUserRole] = useState("");
    const [person, setPerson] = useState({
        applicant_number: "",
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
        otherEthnicGroup: "",
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
        father_deceased: "",
        father_family_name: "", father_given_name: "", father_middle_name: "", father_ext: "", father_contact: "", father_occupation: "",
        father_income: "", father_email: "", mother_deceased: "", mother_family_name: "", mother_given_name: "", mother_middle_name: "",
        mother_contact: "", mother_occupation: "", mother_income: "", guardian: "", guardian_family_name: "", guardian_given_name: "",
        guardian_middle_name: "", guardian_ext: "", guardian_nickname: "", guardian_address: "", guardian_contact: "", guardian_email: "",
        schoolLevel: "",
        schoolLastAttended: "",
        schoolAddress: "",
        courseProgram: "",
        honor: "",
        generalAverage: "",
        yearGraduated: "",
        schoolLevel1: "",
        schoolLastAttended1: "",
        schoolAddress1: "",
        courseProgram1: "",
        honor1: "",
        generalAverage1: "",
        yearGraduated1: "",
        strand: "",
    });



    // ✅ Fetch person data from backend
    const fetchPersonData = async (id) => {
        try {
            const res = await axios.get(`${API_BASE_URL}/api/person/${id}`);
            setPerson(res.data); // make sure backend returns the correct format

        } catch (error) {
            console.error("Failed to fetch person:", error);
        }
    };




    const location = useLocation();
    const queryParams = new URLSearchParams(location.search);
    const queryPersonId = queryParams.get("person_id");

    // do not alter

    useEffect(() => {
        const storedUser = localStorage.getItem("email");
        const storedRole = localStorage.getItem("role");
        const storedID = localStorage.getItem("person_id");

        if (storedUser && storedRole && storedID) {
            setUser(storedUser);
            setUserRole(storedRole);
            setUserID(storedID);


            if (storedRole === "applicant" || storedRole === "registrar") {
                fetchPersonData(storedID);
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
    useImperativeHandle(ref, () => divToPrintRef.current);
    const printDiv = () => {
        const divToPrint = divToPrintRef.current;
        if (divToPrint) {
            // Clone to preserve React bindings
            const clonedDiv = divToPrint.cloneNode(true);

            // Manually add 'checked' attribute to checked checkboxes
            const checkboxes = clonedDiv.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach((checkbox) => {
                if (checkbox.checked) {
                    checkbox.setAttribute("checked", "checked");
                } else {
                    checkbox.removeAttribute("checked");
                }
            });

            const newWin = window.open('', 'Print-Window');
            newWin.document.open();
            newWin.document.write(`
      <html>
        <head>
          <title>Print</title>
          <style>
            @page {
              size: A4;
              margin: 0;
            }

          html, body {
  margin: 0;
  padding: 0;
  width: 210mm;
  min-height: 297mm;   /* was: height: 297mm */
  font-family: Arial;
  overflow: visible;   /* was: overflow: hidden */
  background: #ffffff;
}

            .print-container {
              width: 100%;
              height: auto;
              box-sizing: border-box;
            }

            .student-table {
              margin-top: 15px !important;
            }

            input[type="checkbox"] {
              width: 12px;
              height: 12px;
              transform: scale(1);
              margin: 2px;
            }

            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }

            button {
              display: none;
            }
          </style>
        </head>
        <body onload="window.print(); setTimeout(() => window.close(), 100);">
          <div class="print-container">
            ${clonedDiv.innerHTML}
          </div>
        </body>
      </html>
    `);
            newWin.document.close();
        } else {
            console.error("divToPrintRef is not set.");
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

    // ✅ Shared style for read-only "data" cells — replaces <input readOnly>.
    // Using a plain div avoids Chromium's separate form-control paint path,
    // which is what was causing inconsistent edges once scale/zoom was
    // applied for the PDF export.
    const dataFieldStyle = (extra = {}) => ({
        width: "100%",
        minHeight: "18px",
        whiteSpace: "nowrap",
        overflow: "hidden",
        fontFamily: "Arial",
        ...extra,
    });

    return (
        <Box sx={{ height: "calc(100vh - 150px)", overflowY: "auto", paddingRight: 1, backgroundColor: "transparent", mt: 1, padding: 2 }}>


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

                        <br />
                        <div
                            className="student-table"
                            style={{

                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center", // Center horizontally
                                padding: "10px 20px",
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
                                            width: "120px",
                                            height: "120px",
                                            objectFit: "cover",   // ✅ ensures image fills the circle cleanly
                                            borderRadius: "50%",  // ✅ makes it circular

                                            marginLeft: "10px",
                                            marginTop: "-25px",
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
                                    <div style={{
                                        textAlign: "center",
                                        letterSpacing: "1px",
                                        fontWeight: "bold",
                                        fontFamily: "Arial",
                                        fontSize: "18px",
                                        marginBottom: "5px"
                                    }}>
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
                                        fontSize: "12px",
                                        fontWeight: "bold",
                                        fontFamily: "Arial",
                                        marginLeft: "-130px",
                                        marginTop: "-10px"
                                    }}>
                                        OFFICE OF STUDENT AFFAIRS AND SERVICES
                                    </div>
                                </div>
                            </div>
                        </div>
                        <br />


                    </Container>




                    <form>

                        <table
                            style={{

                                border: "1px solid black",
                                borderCollapse: "collapse",
                                fontFamily: "Arial",
                                width: "760px",
                                margin: "0 auto",
                                textAlign: "center",
                                tableLayout: "fixed",
                            }}
                        >
                            {/*
                              FIX: explicit 40-column colgroup.

                              This table uses table-layout: fixed, but rows split the
                              40-unit grid differently (e.g. 6+34, 6+19+15, 30+10,
                              11+15+14, ...). Without a <colgroup> declaring the
                              actual column grid, the browser/Chromium has to infer
                              column boundaries from whichever row it treats as the
                              reference row — so different rows can end up rendered
                              against slightly different grids. That's what was
                              causing cells like NAME EXTENSION / YEAR LEVEL / FIRST
                              YEAR / ETHNICITY to appear cut off, shifted, or
                              misaligned instead of lining up cleanly under one
                              another. Declaring all 40 columns here forces every
                              row's colSpans onto one consistent grid.
                            */}
                            <colgroup>
                                {Array.from({ length: 40 }).map((_, i) => (
                                    <col key={i} style={{ width: "19px" }} />   // ✅ exact px, not %
                                ))}
                            </colgroup>
                            <tbody>

                                {/* Title: PERSONAL DATA FORM */}
                                <tr>
                                    <td colSpan={40} style={{ textAlign: "center", padding: "10px" }}>
                                        <span
                                            style={{
                                                fontSize: "25px",
                                                color: "black",
                                                fontWeight: "bold",
                                                fontFamily: "Arial",
                                            }}
                                        >
                                            PERSONAL DATA FORM
                                        </span>
                                    </td>
                                </tr>

                                {/* Spacer */}


                                {/* Section Title: I. PERSONAL INFORMATION */}


                                <tr>
                                    {/* Left side: Print Legibly with MUI checkboxes */}
                                    <td colSpan={25} style={{ fontSize: "12px", fontFamily: "Arial", padding: "5px" }}>
                                        <div style={{ display: "flex", alignItems: "center", gap: "15px" }}>
                                            <span style={{ fontWeight: "bold", whiteSpace: "nowrap" }}>
                                                Print Legibly. Mark appropriate boxes.
                                            </span>

                                            <label style={{ display: "flex", alignItems: "center", gap: "5px", fontWeight: "bold", }}>
                                                <input
                                                    type="checkbox"
                                                    checked // or controlled via state
                                                    readOnly
                                                    style={{
                                                        width: "20px",
                                                        height: "20px",
                                                        border: "1px solid black",
                                                        backgroundColor: "white",
                                                        appearance: "none",

                                                        WebkitAppearance: "none",
                                                        MozAppearance: "none",
                                                        display: "inline-block",
                                                        position: "relative",
                                                    }}
                                                    className="custom-checkbox"
                                                />
                                                <span style={{ fontSize: "12px", fontFamily: "Arial" }}>With</span>
                                            </label>

                                            <div style={{ fontWeight: "bold", fontSize: "20px" }}>✓</div>
                                        </div>

                                        <style>
                                            {`
      .custom-checkbox:checked::after {
        content: '✓';
        position: absolute;
        top: -2px;
        left: 3px;
        font-size: 16px;
        color: black;
      }
    `}
                                        </style>
                                    </td>




                                    {/* Right side: Date input and label */}
                                    <td colSpan={15} style={{ fontSize: "12px", fontFamily: "Arial", padding: "5px" }}>
                                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                                            <div
                                                style={dataFieldStyle({
                                                    width: "75%",
                                                    textAlign: "center",
                                                    borderBottom: "1px solid black",
                                                    fontWeight: "bold",
                                                    fontSize: "12px",
                                                    marginBottom: "2px",
                                                })}
                                            >
                                                {shortDate}
                                            </div>
                                            <div style={{ fontWeight: "bold", textAlign: "center" }}>
                                                Date of Registration
                                            </div>
                                        </div>
                                    </td>
                                </tr>

                                <tr>
                                    <td
                                        colSpan={40}
                                        style={{
                                            height: "0.2in",
                                            fontSize: "72.5%",

                                            color: "white",
                                        }}
                                    >
                                        <b>
                                            <b style={{
                                                color: "black",
                                                fontFamily: "Arial",
                                                fontSize: '15px',
                                                textAlign: "left",
                                                display: "block",
                                                fontStyle: 'italic'
                                            }}>
                                                {"\u00A0\u00A0"}I. PERSONAL INFORMATION
                                            </b>

                                        </b>
                                    </td>
                                </tr>
                                {/* SURNAME */}
                                <tr>
                                    <td colSpan={6} style={{ border: "1px solid black", textAlign: "center", padding: "8px", fontWeight: "bold", fontSize: "12px", fontFamily: "Arial" }}>
                                        SURNAME
                                    </td>
                                    <td colSpan={34} style={{ border: "1px solid black", padding: "8px" }}>
                                        <div
                                            style={dataFieldStyle({
                                                fontSize: "15px",
                                                fontWeight: "bold",
                                                letterSpacing: "3px",
                                                textAlign: "left",
                                            })}
                                        >
                                            {person?.last_name?.toUpperCase() || ""}
                                        </div>
                                    </td>
                                </tr>

                                {/* FIRST NAME */}
                                <tr>
                                    <td colSpan={6} style={{ border: "1px solid black", textAlign: "center", padding: "8px", fontWeight: "bold", fontSize: "12px", fontFamily: "Arial" }}>
                                        FIRST NAME
                                    </td>
                                    <td colSpan={34} style={{ border: "1px solid black", padding: "8px" }}>
                                        <div
                                            style={dataFieldStyle({
                                                fontWeight: "bold",
                                                fontSize: "15px",
                                                textAlign: "left",
                                                letterSpacing: "3px",
                                            })}
                                        >
                                            {person?.first_name?.toUpperCase() || ""}
                                        </div>
                                    </td>
                                </tr>

                                {/* MIDDLE NAME */}
                                <tr>
                                    {/* MIDDLE NAME */}
                                    <td colSpan={6} style={{
                                        border: "1px solid black",
                                        textAlign: "Center",
                                        fontWeight: "bold",
                                        fontSize: "12px",
                                        fontFamily: "Arial"

                                    }}>
                                        MIDDLE NAME
                                    </td>

                                    <td colSpan={19} style={{
                                        border: "1px solid black",
                                        padding: "8px",

                                    }}>
                                        <div
                                            style={dataFieldStyle({
                                                fontWeight: "bold",
                                                fontSize: "15px",
                                                letterSpacing: "3px",
                                                textAlign: "left",
                                            })}
                                        >
                                            {person?.middle_name?.toUpperCase() || ""}
                                        </div>
                                    </td>

                                    {/* NAME EXTENSION */}
                                    <td colSpan={15} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontWeight: "bold",
                                        fontSize: "12px",
                                        verticalAlign: "top",
                                        fontFamily: "Arial",

                                    }}>
                                        NAME EXTENSION (e.g. Jr., Sr.)
                                        <div
                                            style={dataFieldStyle({
                                                fontWeight: "bold",
                                                fontSize: "15px",
                                                letterSpacing: "3px",
                                                textAlign: "left",
                                            })}
                                        >
                                            {person?.extension?.toUpperCase() || ""}
                                        </div>
                                    </td>
                                </tr>


                                {/* COURSE */}
                                <tr>
                                    {/* COURSE (COMPLETE NAME) */}
                                    <td
                                        colSpan={30}
                                        style={{
                                            border: "1px solid black",
                                            textAlign: "left",
                                            fontSize: "12px",
                                            fontFamily: "Arial",
                                            verticalAlign: "top",
                                        }}
                                    >
                                        <div style={{ fontWeight: "bold" }}>COURSE (COMPLETE NAME)</div>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "12px",
                                                textTransform: "uppercase",
                                            })}
                                        >
                                            {curriculumOptions.length > 0
                                                ? curriculumOptions.find(
                                                    (item) =>
                                                        item?.curriculum_id?.toString() ===
                                                        (person?.program ?? "").toString()
                                                )?.program_description?.toUpperCase() ||
                                                (person?.program?.toString()?.toUpperCase() ?? "")
                                                : "LOADING..."}
                                        </div>
                                    </td>

                                    {/* YEAR LEVEL */}
                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontFamily: "Arial",
                                        fontSize: "12px",
                                        verticalAlign: "top"
                                    }}>
                                        <div style={{ fontWeight: "bold" }}>YEAR LEVEL (1,2,3,4,5)</div>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                                textTransform: "uppercase",
                                            })}
                                        >
                                            {person?.yearLevel?.toUpperCase() || ""}
                                        </div>
                                    </td>
                                </tr>


                                <tr>
                                    {/* DATE OF BIRTH */}
                                    <td colSpan={11} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontFamily: "Arial",
                                        fontSize: "12px",
                                        verticalAlign: "top"
                                    }}>
                                        <div style={{ fontWeight: "bold" }}>DATE OF BIRTH (e.g. June 15, 2019)</div>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                                textTransform: "uppercase",
                                            })}
                                        >
                                            {person.birthOfDate
                                                ? new Date(person.birthOfDate).toLocaleDateString("en-US", {
                                                    year: "numeric",
                                                    month: "long",
                                                    day: "numeric"
                                                })
                                                : ""}
                                        </div>
                                    </td>


                                    {/* PLACE OF BIRTH */}
                                    <td colSpan={15} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontSize: "12px",
                                        verticalAlign: "top",
                                        fontFamily: "Arial",
                                    }}>
                                        <div style={{ fontWeight: "bold" }}>PLACE OF BIRTH</div>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.birthPlace || ""}
                                        </div>
                                    </td>

                                    {/* ETHNICITY */}
                                    <td colSpan={14} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontFamily: "Arial",
                                        fontSize: "12px",
                                        verticalAlign: "top"
                                    }}>
                                        <div style={{ fontWeight: "bold" }}>ETHNICITY (e.g. Tagbanua, Palaw’an)<br />
                                            Pangkat etniko / Kinaanibang pangkat</div>

                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.tribeEthnicGroup || ""}
                                        </div>
                                    </td>
                                </tr>
                                {/* STUDENT ID NUMBER */}
                                <tr>
                                    {/* STUDENT ID NUMBER */}
                                    <td colSpan={11}
                                        style={{
                                            border: "1px solid black",
                                            textAlign: "left",
                                            fontFamily: "Arial",
                                            fontWeight: "bold",
                                            fontSize: "12px",
                                            verticalAlign: "top"
                                        }}
                                    >
                                        <div style={{ fontWeight: "bold" }}>APPLICANT ID:</div>

                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontWeight: "normal",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.applicant_number || ""}
                                        </div>
                                    </td>


                                    {/* LEARNER'S REFERENCE NUMBER */}
                                    <td colSpan={15}

                                        style={{
                                            border: "1px solid black",
                                            textAlign: "left",
                                            fontFamily: "Arial",
                                            fontSize: "12px",
                                            verticalAlign: "top"
                                        }}>
                                        <div style={{ fontWeight: "bold" }}>LEARNER'S REFERENCE NUMBER</div>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.lrnNumber || ""}
                                        </div>
                                    </td>

                                    {/* DISABILITY */}
                                    <td colSpan={14} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontFamily: "Arial",
                                        fontSize: "12px",
                                        verticalAlign: "top"
                                    }}>
                                        <div style={{ fontWeight: "bold" }}>DISABILITY</div>

                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.pwdType || ""}
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    {/* SEX */}
                                    <td
                                        colSpan={11}
                                        style={{
                                            border: "1px solid black",
                                            textAlign: "left",
                                            fontWeight: "bold",
                                            fontSize: "12px",
                                            verticalAlign: "top",
                                            fontFamily: "Arial",
                                        }}
                                    >
                                        SEX
                                        <div
                                            style={{
                                                display: "flex",
                                                justifyContent: "center",
                                                gap: "40px",
                                                alignItems: "center",
                                                fontFamily: "Arial",
                                                width: "100%",
                                                marginTop: "5px",
                                            }}
                                        >
                                            <label
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "5px",
                                                    fontSize: "15px",
                                                    fontFamily: "Arial",
                                                    marginBottom: "10px"
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={person.gender === 0}
                                                    readOnly
                                                    style={{
                                                        width: "20px",
                                                        height: "20px",
                                                        border: "1px solid black",
                                                        backgroundColor: "white",

                                                        appearance: "none",
                                                        WebkitAppearance: "none",
                                                        MozAppearance: "none",
                                                        display: "inline-block",
                                                        position: "relative",
                                                    }}
                                                    className="custom-checkbox"
                                                />
                                                Male
                                            </label>

                                            <label
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: "5px",
                                                    fontSize: "15px",
                                                    fontFamily: "Arial",
                                                    marginBottom: "10px"
                                                }}
                                            >
                                                <input
                                                    type="checkbox"
                                                    checked={person.gender === 1}
                                                    readOnly
                                                    style={{
                                                        width: "20px",
                                                        height: "20px",
                                                        border: "1px solid black",
                                                        backgroundColor: "white",
                                                        appearance: "none",
                                                        WebkitAppearance: "none",
                                                        MozAppearance: "none",

                                                        display: "inline-block",
                                                        position: "relative",
                                                    }}
                                                    className="custom-checkbox"
                                                />
                                                Female
                                            </label>
                                        </div>

                                        {/* ✅ Style block for ✓ checkmark */}
                                        <style>
                                            {`
      .custom-checkbox:checked::after {
        content: '✓';
        position: absolute;
        top: -2px;
        left: 3px;
        font-size: 16px;
        color: black;
      }
    `}
                                        </style>
                                    </td>




                                    {/* E-MAIL ADDRESS */}
                                    <td colSpan={15} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontSize: "12px",
                                        verticalAlign: "top",
                                        fontFamily: "Arial",
                                    }}>
                                        <div style={{ fontWeight: "bold" }}>E-MAIL ADDRESS</div>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.emailAddress || ""}
                                        </div>
                                    </td>
                                    <td colSpan={14} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontSize: "12px",
                                        verticalAlign: "top",
                                        fontFamily: "Arial",
                                    }}>
                                        <div style={{ fontWeight: "bold" }}>YEAR GRADUATED</div>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.yearGraduated1 || ""}
                                        </div>
                                    </td>
                                </tr>


                                <tr>
                                    <td
                                        colSpan={18}
                                        style={{
                                            border: "1px solid black",
                                            verticalAlign: "top",
                                            fontSize: "12px",

                                            padding: "8px",
                                            fontFamily: "Arial",
                                        }}
                                    >
                                        <div style={{ fontWeight: "bold", paddingLeft: "-10px" }}>CIVIL STATUS</div>
                                        <div
                                            style={{
                                                marginTop: "5px",
                                                display: "flex",
                                                flexWrap: "wrap",
                                                alignItems: "center",
                                                paddingLeft: "50px",
                                            }}
                                        >
                                            {/* Standard Civil Status Options */}
                                            {["Single", "Married", "Widowed", "Separated", "Annulled"].map((status) => (
                                                <label
                                                    key={status}
                                                    style={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        width: "50%",

                                                        fontSize: "15px",
                                                        fontFamily: "Arial",
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={person.civilStatus === status}
                                                        readOnly
                                                        style={{
                                                            width: "20px",
                                                            height: "20px",
                                                            border: "1px solid black",
                                                            backgroundColor: "white",
                                                            appearance: "none",
                                                            WebkitAppearance: "none",
                                                            MozAppearance: "none",
                                                            display: "inline-block",
                                                            position: "relative",
                                                            marginRight: "5px",
                                                        }}
                                                        className="custom-checkbox"
                                                    />
                                                    {status}
                                                </label>
                                            ))}

                                            {/* Others, specify */}
                                            <div
                                                style={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    width: "100%",
                                                    fontSize: "15px",
                                                    fontFamily: "Arial",


                                                }}
                                            >
                                                <label style={{ display: "flex", alignItems: "center", marginRight: "10px" }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={
                                                            person.civilStatus &&
                                                            !["Single", "Married", "Widowed", "Separated", "Annulled"].includes(person.civilStatus)
                                                        }
                                                        readOnly
                                                        style={{
                                                            width: "20px",

                                                            height: "20px",

                                                            border: "1px solid black",
                                                            backgroundColor: "white",
                                                            appearance: "none",
                                                            WebkitAppearance: "none",
                                                            MozAppearance: "none",
                                                            display: "inline-block",
                                                            position: "relative",
                                                            marginRight: "5px",
                                                        }}
                                                        className="custom-checkbox"
                                                    />
                                                    Others, specify:
                                                </label>
                                                <span
                                                    style={{
                                                        borderBottom: "1px solid black",
                                                        width: "100px",
                                                        display: "inline-block",
                                                        marginTop: "10px",
                                                    }}
                                                >
                                                    {person.civilStatus &&
                                                        !["Single", "Married", "Widowed", "Separated", "Annulled"].includes(person.civilStatus)
                                                        ? person.civilStatus
                                                        : ""}
                                                </span>
                                            </div>
                                        </div>


                                        <style>
                                            {`
      .custom-checkbox:checked::after {
        content: '✓';
        position: absolute;
        top: -2px;
        left: 4px;
        font-size: 16px;
        color: black;
      }
    `}
                                        </style>
                                    </td>




                                    {/* PERMANENT / HOME ADDRESS */}
                                    <td
                                        colSpan={16}
                                        style={{
                                            border: "1px solid black",
                                            verticalAlign: "top",
                                            fontSize: "12px",
                                            fontFamily: "Arial",
                                            textAlign: "left",
                                        }}
                                    >
                                        <div style={{ fontWeight: "bold" }}>PERMANENT / HOME ADDRESS</div>

                                        <div
                                            style={{
                                                marginTop: "5px",
                                                fontSize: "15px",
                                                fontFamily: "Arial",
                                                padding: "2px 4px",
                                                minHeight: "20px",
                                                whiteSpace: "pre-wrap",
                                                wordBreak: "break-word",
                                            }}
                                        >
                                            {person.presentStreet || person.presentBarangay || person.presentMunicipality
                                                ? `${person.presentStreet || ""} ${person.presentBarangay || ""}, ${person.presentMunicipality || ""}`
                                                : ""}
                                        </div>



                                        <div
                                            style={{
                                                marginTop: "10px",
                                                borderTop: "1px solid black",
                                                paddingTop: "8px",

                                                fontSize: "12px",
                                            }}
                                        >
                                            <div style={{ fontWeight: "bold" }}>HOUSEHOLD #</div>
                                            <div
                                                style={dataFieldStyle({
                                                    marginTop: "5px",
                                                    fontSize: "15px",
                                                    padding: "2px 4px",
                                                })}
                                            >
                                                {person.presentDswdHouseholdNumber || ""}
                                            </div>

                                        </div>
                                    </td>


                                    {/* ZIP CODE */}
                                    <td colSpan={6} style={{
                                        border: "1px solid black",
                                        verticalAlign: "top",
                                        fontSize: "12px",
                                        fontFamily: "Arial"
                                    }}>
                                        <div style={{ fontWeight: "bold" }}>ZIP CODE</div>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                                padding: "2px 4px",
                                            })}
                                        >
                                            {person.presentZipCode || ""}
                                        </div>
                                    </td>
                                </tr>


                                <tr>
                                    {/* CITIZENSHIP */}
                                    <td colSpan={8} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontFamily: "Arial",
                                        fontSize: "12px"
                                    }}>
                                        <div style={{ fontWeight: "bold" }}>CITIZENSHIP</div>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.citizenship || ""}
                                        </div>
                                    </td>

                                    {/* HEIGHT (m) */}
                                    <td colSpan={6} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontFamily: "Arial",
                                        fontSize: "12px"
                                    }}>
                                        <div style={{ fontWeight: "bold" }}>HEIGHT (m)</div>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.height || ""}
                                        </div>
                                    </td>

                                    {/* WEIGHT (kg) */}
                                    <td colSpan={6} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontFamily: "Arial",
                                        fontSize: "12px"
                                    }}>
                                        <div style={{ fontWeight: "bold" }}>WEIGHT (kg)</div>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.weight || ""}
                                        </div>
                                    </td>

                                    {/* BLOOD TYPE */}
                                    <td colSpan={6} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontFamily: "Arial",
                                        fontSize: "12px"
                                    }}>
                                        <div style={{ fontWeight: "bold" }}>BLOOD TYPE</div>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {""}
                                        </div>
                                    </td>

                                    {/* PERMANENT CONTACT NUMBER */}
                                    <td colSpan={14} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontFamily: "Arial",
                                        fontSize: "12px"
                                    }}>
                                        <div style={{ fontWeight: "bold" }}> PERMANENT CONTACT NUMBER</div>

                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.cellphoneNumber || ""}
                                        </div>
                                    </td>
                                </tr>
                                <tr>
                                    <td
                                        colSpan={40}
                                        style={{
                                            height: "0.2in",
                                            fontSize: "72.5%",

                                            color: "white",
                                        }}
                                    >
                                        <b>
                                            <b style={{
                                                color: "black",
                                                fontFamily: "Arial",
                                                fontSize: '15px',
                                                textAlign: "left",
                                                display: "block",
                                                fontStyle: 'italic'
                                            }}>
                                                {"\u00A0\u00A0"}II. FAMILY BACKGROUND
                                            </b>

                                        </b>
                                    </td>
                                </tr>

                                <tr>

                                    <td colSpan={10}
                                        style={{
                                            border: "1px solid black",
                                            textAlign: "left",
                                            paddingLeft: "10px",
                                            fontWeight: "bold",
                                            fontFamily: "Arial",
                                            fontSize: "12px"
                                        }}>
                                        FATHER'S NAME

                                    </td>

                                    {/* SURNAME / FAMILY NAME */}
                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontFamily: "Arial",
                                        fontSize: "12px"
                                    }}>
                                        <div style={{ fontWeight: "bold" }}>SURNAME / FAMILY NAME</div>

                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.father_family_name || ""}
                                        </div>
                                    </td>

                                    {/* GIVEN NAME */}
                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontFamily: "Arial",
                                        fontSize: "12px"
                                    }}>
                                        <div style={{ fontWeight: "bold" }}>GIVEN NAME</div>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.father_given_name || ""}
                                        </div>
                                    </td>

                                    {/* MIDDLE NAME */}
                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontFamily: "Arial",
                                        fontSize: "12px"
                                    }}>
                                        <div style={{ fontWeight: "bold" }}>MIDDLE NAME</div>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.father_middle_name || ""}
                                        </div>
                                    </td>
                                </tr>










                                <tr>

                                    <td colSpan={10}
                                        style={{
                                            border: "1px solid black",
                                            textAlign: "left",
                                            paddingLeft: "10px",
                                            fontWeight: "bold",
                                            fontSize: "12px",
                                            fontFamily: "Arial",
                                        }}>
                                        MOTHER`S NAME

                                    </td>

                                    {/* SURNAME (Not Yet Married) */}
                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontFamily: "Arial",
                                        fontSize: "12px"
                                    }}>
                                        <div style={{ fontWeight: "bold", fontFamily: "Arial", }}>SURNAME (Not Yet Married)</div>

                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.mother_family_name || ""}
                                        </div>
                                    </td>

                                    {/* GIVEN NAME */}
                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontFamily: "Arial",
                                        fontSize: "12px"
                                    }}>
                                        <div style={{ fontWeight: "bold" }}>GIVEN NAME</div>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.mother_given_name || ""}
                                        </div>
                                    </td>
                                    {/* MIDDLE NAME (Not yet married) */}
                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        fontFamily: "Arial",
                                        fontSize: "12px"
                                    }}>
                                        <div style={{ fontWeight: "bold", fontFamily: "Arial", }}>   MIDDLE NAME (Not yet married)</div>

                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.mother_middle_name || ""}
                                        </div>
                                    </td>
                                </tr>

                                <tr>
                                    <td
                                        colSpan={40}
                                        style={{
                                            height: "0.2in",
                                            fontSize: "72.5%",

                                            color: "white",
                                        }}
                                    >
                                        <b>
                                            <b style={{
                                                color: "black",
                                                fontFamily: "Arial",
                                                fontSize: '15px',
                                                textAlign: "left",
                                                display: "block",
                                                fontStyle: 'italic'
                                            }}>
                                                {"\u00A0\u00A0"}FAMILY PER CAPITA INCOME
                                            </b>

                                        </b>
                                    </td>
                                </tr>

                                {/* HEADER ROW */}
                                <tr>
                                    <td colSpan={20} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "8px",
                                        fontWeight: "bold",
                                        fontFamily: "Arial",
                                        fontSize: "12px",
                                        verticalAlign: "top"
                                    }}>
                                        NAME OF FAMILY MEMBER

                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "8px",
                                        fontWeight: "bold",
                                        fontSize: "12px",
                                        verticalAlign: "top",
                                        fontFamily: "Arial",
                                    }}>
                                        OCCUPATION

                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "8px",
                                        fontWeight: "bold",
                                        fontSize: "12px",
                                        verticalAlign: "top",
                                        fontFamily: "Arial",
                                    }}>
                                        MONTHLY INCOME

                                    </td>
                                </tr>

                                <tr style={{ height: "5px" }}>

                                    <td colSpan={7} style={{
                                        border: "1px solid black",
                                        textAlign: "center",
                                        padding: "2px",
                                        fontWeight: "bold",
                                        fontSize: "12px",
                                        fontFamily: "Arial"
                                    }}>
                                        Father

                                    </td>


                                    <td colSpan={13}

                                        style={{
                                            border: "1px solid black",
                                            textAlign: "left",
                                            padding: "2px",
                                            fontFamily: "Arial",
                                            fontSize: "12px"
                                        }}>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {`${person.father_given_name || ""} ${person.father_middle_name || ""} ${person.father_family_name || ""}`}
                                        </div>
                                    </td>


                                    <td colSpan={10}
                                        style={{
                                            border: "1px solid black",
                                            textAlign: "left",
                                            padding: "2px",
                                            fontFamily: "Arial",
                                            fontSize: "12px"
                                        }}>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.father_occupation || ""}
                                        </div>
                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",
                                        fontFamily: "Arial",
                                        fontSize: "12px"
                                    }}>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.father_income || ""}
                                        </div>
                                    </td>
                                </tr>

                                <tr style={{ height: "5px" }}>
                                    <td colSpan={7} style={{
                                        border: "1px solid black",
                                        textAlign: "center",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontFamily: "Arial",
                                        fontSize: "12px"
                                    }}>
                                        Mother

                                    </td>

                                    <td colSpan={13} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontFamily: "Arial",
                                        fontSize: "12px"
                                    }}>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {`${person.mother_given_name || ""} ${person.mother_middle_name || ""} ${person.mother_family_name || ""}`}
                                        </div>
                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontFamily: "Arial",
                                        fontSize: "12px"
                                    }}>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.mother_occupation || ""}
                                        </div>
                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontFamily: "Arial",
                                        fontSize: "12px"
                                    }}>
                                        <div
                                            style={dataFieldStyle({
                                                marginTop: "5px",
                                                fontSize: "15px",
                                            })}
                                        >
                                            {person.mother_income || ""}
                                        </div>
                                    </td>
                                </tr>



                                <tr style={{ height: "5px" }}>

                                    <td colSpan={7} style={{
                                        border: "1px solid black",
                                        textAlign: "center",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px",
                                        fontFamily: "Arial",
                                    }}>
                                        Siblings

                                    </td>

                                    <td colSpan={13} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "15px"
                                    }}>


                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "15px"
                                    }}>


                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "15px"
                                    }}>


                                    </td>
                                </tr>



                                <tr style={{ height: "5px" }}>

                                    <td colSpan={7} style={{
                                        border: "1px solid black",
                                        textAlign: "right",
                                        fontFamily: "Arial",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "15px"
                                    }}>
                                        1.

                                    </td>

                                    <td colSpan={13} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>
                                </tr>



                                <tr style={{ height: "5px" }}>

                                    <td colSpan={7} style={{
                                        border: "1px solid black",
                                        textAlign: "right",
                                        fontFamily: "Arial",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "15px"
                                    }}>
                                        2.

                                    </td>


                                    <td colSpan={13} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>
                                </tr>



                                <tr style={{ height: "5px" }}>

                                    <td colSpan={7} style={{
                                        border: "1px solid black",
                                        textAlign: "right",
                                        fontFamily: "Arial",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "15px"
                                    }}>
                                        3.

                                    </td>

                                    <td colSpan={13} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>
                                </tr>



                                <tr style={{ height: "5px" }}>

                                    <td colSpan={7} style={{
                                        border: "1px solid black",
                                        textAlign: "right",
                                        fontFamily: "Arial",
                                        padding: "2px",
                                        fontWeight: "bold",
                                        fontSize: "15px"
                                    }}>
                                        4.

                                    </td>


                                    <td colSpan={13} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>
                                </tr>


                                <tr style={{ height: "5px" }}>

                                    <td colSpan={7} style={{
                                        border: "1px solid black",
                                        textAlign: "right",
                                        fontFamily: "Arial",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "15px"
                                    }}>
                                        5.

                                    </td>


                                    <td colSpan={13} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>


                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>

                                </tr>


                                <tr style={{ height: "5px" }}>

                                    <td colSpan={7} style={{
                                        border: "1px solid black",
                                        textAlign: "right",
                                        fontFamily: "Arial",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "15px"
                                    }}>

                                    </td>


                                    <td colSpan={13} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>

                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",  // Reduced padding to fit in 10px height
                                        fontWeight: "bold",
                                        fontSize: "12px"
                                    }}>


                                    </td>


                                    <td colSpan={10} style={{
                                        border: "1px solid black",
                                        textAlign: "left",
                                        padding: "2px",

                                        fontSize: "15px",
                                        fontFamily: "Arial",
                                    }}>
                                        Total: ₱{(Number(person.father_income || 0) + Number(person.mother_income || 0)).toLocaleString("en-PH", {
                                            minimumFractionDigits: 2,
                                            maximumFractionDigits: 2
                                        })}
                                    </td>
                                </tr>





                            </tbody>
                        </table>

                        <table
                            style={{
                                marginTop: "-50px",
                                borderCollapse: "collapse",
                                fontFamily: "Arial",
                                width: "760px",
                                margin: "0 auto",
                                textAlign: "center",
                                tableLayout: "fixed",
                            }}
                        >
                            {/* Same 40-column grid as the main table above, so this
                                table's colSpan={40} row lines up with the same
                                8in width and doesn't drift relative to it. */}
                            <colgroup>
                                {Array.from({ length: 40 }).map((_, i) => (
                                    <col key={i} style={{ width: "19px" }} />   // ✅ exact px, not %
                                ))}
                            </colgroup>
                            <tbody>
                                {/* Other table rows here... */}

                                <tr>
                                    <td colSpan={40} style={{ paddingTop: '5px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                                            <div
                                                style={{
                                                    display: 'inline-block',
                                                    width: '250px',
                                                    textAlign: 'center',
                                                }}
                                            >
                                                <div
                                                    style={{
                                                        borderBottom: '1px solid black',
                                                        height: '40px',
                                                        marginBottom: '5px',
                                                    }}
                                                ></div>
                                                <div
                                                    style={{
                                                        fontSize: '12px',
                                                        fontWeight: 'bold',
                                                        fontFamily: "Arial",
                                                    }}
                                                >
                                                    Signature
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                </tr>

                                {/* Additional rows if needed... */}
                            </tbody>
                        </table>

                    </form>
                </div>

            </Container>


        </Box >

    );
});

export default PersonalDataForm;
