// Constructor for an exception which is thrown if the file
// being parsed is not in a valid IGC format.
function IGCException(message) {
    'use strict';
    this.message = message;
    this.name = "IGCException";
}

// Parses an IGC logger file.
function parseIGC(igcFile) {
    'use strict';

    // Looks up the manufacturer name corresponding to
    // the three letter code in the first line of the IGC file
    // (the 'A' record).
    function parseManufacturer(aRecord) {
        const manufacturers = {
            'GCS': 'Garrecht',
            'CAM': 'Cambridge Aero Instruments',
            'DSX': 'Data Swan',
            'EWA': 'EW Avionics',
            'FIL': 'Filser',
            'FLA': 'FLARM',
            'SCH': 'Scheffel',
            'ACT': 'Aircotec',
            'NKL': 'Nielsen Kellerman',
            'LXN': 'LX Navigation',
            'IMI': 'IMI Gliding Equipment',
            'NTE': 'New Technologies s.r.l.',
            'PES': 'Peschges',
            'PRT': 'Print Technik',
            'SDI': 'Streamline Data Instruments',
            'TRI': 'Triadis Engineering GmbH',
            'LXV': 'LXNAV d.o.o.',
            'WES': 'Westerboer',
            'XCS': 'XCSoar',
            'ZAN': 'Zander'
        };

        const manufacturerInfo = {
            manufacturer: 'Unknown',
            serial: aRecord.substring(4, 7)
        };

        const manufacturerCode = aRecord.substring(1, 4);
        if (manufacturers[manufacturerCode]) {
            manufacturerInfo.manufacturer = manufacturers[manufacturerCode];
        }

        return manufacturerInfo;
    }

    // Extracts the flight date from the IGC file.
    function extractDate(igcFile) {
        // Date is recorded as: HFDTEddmmyy (where HFDTE is a literal and dddmmyy are digits).
        const dateFormat1 = /H[FO]DTE([\d]{2})([\d]{2})([\d]{2})/,
            dateFormat2 = /H[FO]DTEDATE:([\d]{2})([\d]{2})([\d]{2})/;

        const dateRecord = igcFile.match(dateFormat1) != null ?
            igcFile.match(dateFormat1) : igcFile.match(dateFormat2);

        if (dateRecord === null)
            throw new IGCException('The file does not contain a date header.');

        const day = parseInt(dateRecord[1], 10);
        // Javascript numbers months from zero, not 1!
        const month = parseInt(dateRecord[2], 10) - 1;
        // The IGC specification has a built-in Millennium Bug (2-digit year).
        // I will arbitrarily assume that any year before "80" is in the 21st century.
        let year = parseInt(dateRecord[3], 10);

        if (year < 80) {
            year += 2000;
        } else {
            year += 1900;
        }
        return new Date(Date.UTC(year, month, day));
    }

    function parseHeader(headerRecord) {
        const headerSubtypes = {
            'PLT': 'Pilot',
            'CM2': 'Crew member 2',
            'GTY': 'Glider type',
            'GID': 'Glider ID',
            'DTM': 'GPS Datum',
            'RFW': 'Firmware version',
            'RHW': 'Hardware version',
            'FTY': 'Flight recorder type',
            'GPS': 'GPS',
            'PRS': 'Pressure sensor',
            'FRS': 'Security suspect, use validation program',
            'CID': 'Competition ID',
            'CCL': 'Competition class'
        };

        const headerName = headerSubtypes[headerRecord.substring(2, 5)];
        if (headerName !== undefined) {
            const colonIndex = headerRecord.indexOf(':');
            if (colonIndex !== -1) {
                const headerValue = headerRecord.substring(colonIndex + 1);
                if (headerValue.length > 0 && /([^\s]+)/.test(headerValue)) {
                    return {
                        name: headerName,
                        value: headerValue
                    };
                }
            }
        }
    }

    // Parses a latitude and longitude in the form:
    // DDMMmmmNDDDMMmmmE
    // where M = minutes and m = decimal places of minutes.
    function parseLatLong(latLongString) {
        let latitude = parseFloat(latLongString.substring(0, 2)) +
            parseFloat(latLongString.substring(2, 7)) / 60000.0;
        if (latLongString.charAt(7) === 'S') {
            latitude = -latitude;
        }

        let longitude = parseFloat(latLongString.substring(8, 11)) +
            parseFloat(latLongString.substring(11, 16)) / 60000.0;
        if (latLongString.charAt(16) === 'W') {
            longitude = -longitude;
        }

        return [latitude, longitude];
    }

    function parsePosition(positionRecord,  model, flightDate) {
        // Regex to match position records:
        // Hours, minutes, seconds, latitude, N or S, longitude, E or W,
        // Fix validity ('A' = 3D fix, 'V' = 2D or no fix),
        // pressure altitude, GPS altitude.
        // Latitude and longitude are in degrees and minutes, with the minutes
        // value multiplied by 1000 so that no decimal point is needed.
        //                      hours    minutes  seconds  latitude    longitude        press alt  gps alt
        const positionRegex = /^B([\d]{2})([\d]{2})([\d]{2})([\d]{7}[NS][\d]{8}[EW])([AV])([\d]{5})([\d]{5})/;
        const positionMatch = positionRecord.match(positionRegex);
        if (positionMatch) {
            // Convert the time to a date and time. Start by making a clone of the date
            // object that represents the date given in the headers:
            const positionTime = new Date(flightDate.getTime());
            positionTime.setUTCHours(parseInt(positionMatch[1], 10), parseInt(positionMatch[2], 10), parseInt(positionMatch[3], 10));
            // If the flight crosses midnight (UTC) then we now have a time that is 24 hours out.
            // We know that this is the case if the time is earlier than the first position fix.
            if (model.recordTime.length > 0 &&
                model.recordTime[0] > positionTime) {
                positionTime.setDate(flightDate.getDate() + 1);
            }

            return {
                recordTime: positionTime,
                latLong: parseLatLong(positionMatch[4]),
                pressureAltitude: parseInt(positionMatch[6], 10),
                gpsAltitude: parseInt(positionMatch[7], 10)
            };
        }
    }

    function parseTask(taskRecord) {
        const taskRegex = /^C([\d]{7}[NS][\d]{8}[EW])(.*)/;
        const taskMatch = taskRecord.match(taskRegex);
        const degreeSymbol = '\u00B0';

        if (taskMatch) {
            let name = taskMatch[2];

            // If the turnpoint name is blank, use the latitude and longitude.
            if (name.trim().length === 0) {
                name = taskRecord.substring(1, 3) +
                degreeSymbol +
                taskRecord.substring(3, 5) +
                '.' +
                taskRecord.substring(5, 8) +
                "' " +
                taskRecord.charAt(8) +
                ', ' +
                taskRecord.substring(9, 12) +
                degreeSymbol +
                taskRecord.substring(12, 14) +
                '.' +
                taskRecord.substring(14, 17) +
                "' " +
                taskRecord.charAt(17);
            }

            return {
                latLong: parseLatLong(taskMatch[1]),
                name: name
            };
        }
    }

    // ---- Start of IGC parser code ----

    const invalidFileMessage = 'This does not appear to be an IGC file.';
    const igcLines = igcFile.split('\n');
    if (igcLines.length < 2) {
        throw new IGCException(invalidFileMessage);
    }

    // Declare the model object that is to be returned;
    // this contains the position and altitude data and the header
    // values.
    const model = {
        headers: [],
        recordTime: [],
        latLong: [],
        pressureAltitude: [],
        gpsAltitude: [],
        task: {
            coordinates: [],
            names: [],
            takeoff: "",
            landing: ""
        }
    };

    // The first line should begin with 'A' followed by
    // a 3-character manufacturer Id and a 3-character serial number.
    if (/^A[\w]{6}/.test(igcLines[0])) {
        // this is a valid 6 character code
    } else if (/^A[\w]{3}/.test(igcLines[0])) {
        // the serial number is missing
        console.log("The serial number is missing. ")
    } else {
        throw new IGCException(invalidFileMessage);
    }

    const manufacturerInfo = parseManufacturer(igcLines[0]);
    model.headers.push({
        name: 'Logger manufacturer',
        value: manufacturerInfo.manufacturer
    });

    model.headers.push({
        name: 'Logger serial number',
        value: manufacturerInfo.serial
    });

    const flightDate = extractDate(igcFile);

    let lineIndex;
    let positionData;
    let recordType;
    let currentLine;
    let turnPoint; // for task declaration lines
    let headerData;
    for (lineIndex = 0; lineIndex < igcLines.length; lineIndex++) {
        currentLine = igcLines[lineIndex];
        recordType = currentLine.charAt(0);
        switch (recordType) {
            case 'B': // Position fix
                positionData = parsePosition(currentLine, model, flightDate);
                if (positionData) {
                    model.recordTime.push(positionData.recordTime);
                    model.latLong.push(positionData.latLong);
                    model.pressureAltitude.push(positionData.pressureAltitude);
                    model.gpsAltitude.push(positionData.gpsAltitude);
                }
                break;

            case 'C': // Task declaration
                turnPoint = parseTask(currentLine);
                if (turnPoint) {
                    model.task.coordinates.push(turnPoint.latLong);
                    model.task.names.push(turnPoint.name);
                }
                break;

            case 'H': // Header information
                headerData = parseHeader(currentLine);
                if (headerData) {
                    model.headers.push(headerData);
                }
                break;
        }
    }

// Extract takeoff and landing  names from model.task and reduce model.task.coordinates to what we want to plot
// Throw away takeoff and landing coordinates as we won't be using them
if(model.task.names.length > 0)  {
    const takeoffName = model.task.takeoff = model.task.names.shift();
    if  (model.task.coordinates[0][0]!==0)  {
       model.task.takeoff=takeoffName;
   }
else {
            model.task.takeoff="";
   }

model.task.coordinates.shift();
    const landingName = model.task.names.pop();
    if  (model.task.coordinates[model.task.coordinates.length-1][0]!==0)  {
       model.task.landing=landingName;
   }
   else     {
            model.task.landing="";
     }
    model.task.coordinates.pop();
    }

    return model;
}

