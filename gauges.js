function closestUnicodeFraction(number) {
    // Define common Unicode fractions
    const fractions = [
        { value: 0, unicode: '' },
        { value: 1 / 2, unicode: '½' },
        { value: 1 / 3, unicode: '⅓' },
        { value: 2 / 3, unicode: '⅔' },
        { value: 1 / 4, unicode: '¼' },
        { value: 3 / 4, unicode: '¾' },
        { value: 1 / 5, unicode: '⅕' },
        { value: 2 / 5, unicode: '⅖' },
        { value: 3 / 5, unicode: '⅗' },
        { value: 4 / 5, unicode: '⅘' },
        { value: 1 / 6, unicode: '⅙' },
        { value: 2 / 6, unicode: '⅚' },
        { value: 1 / 8, unicode: '⅛' },
        { value: 3 / 8, unicode: '⅜' },
        { value: 5 / 8, unicode: '⅝' },
        { value: 7 / 8, unicode: '⅞' },
        { value: 1, unicode: '+1' },
    ];

    // Find the closest fraction
    let closestFraction = fractions[0];
    let minDifference = Math.abs(number - closestFraction.value);

    for (const fraction of fractions) {
        const difference = Math.abs(number - fraction.value);
        if (difference < minDifference) {
            minDifference = difference;
            closestFraction = fraction;
        }
    }

    return closestFraction.unicode;
}

function formatFeet(feet) {
  if (feet > 0) {
    return `${feet}′`;
  } else {
    return '';
  }
}

function formatInches(inches, fraction) {
  if (inches == 0 && fraction == '') {
    return '';
  } else if (inches == 0) {
    return `${fraction}″`;
  } else if (fraction == '') {
    return `${inches}″`;
  } else {
    return `${inches}${fraction}″`;
  }
}

function convertMillimetersToImperial(mm) {
  if (mm.length != 4) return mm;

  // 1 inch = 25.4 millimeters
  const inches = mm / 25.4;

  // 1 foot = 12 inches
  let feet = Math.floor(inches / 12);

  // Remaining inches after converting to feet, rounded to nearest 1/8 in
  let remainingInches = inches - feet * 12;
  remainingInches = Math.round(remainingInches * 8) / 8;

  // ✅ If rounding pushed us to 12", carry to feet
  if (remainingInches >= 12) {
    feet += Math.floor(remainingInches / 12);
    remainingInches = remainingInches % 12;
  }

  // Calculate fractional inches
  const fractionalInches = remainingInches % 1;
  const fractionString = closestUnicodeFraction(fractionalInches);

  // Build the user-presentable string (no extra space if feet is 0)
  const parts = [
    formatFeet(feet),
    formatInches(Math.floor(remainingInches), fractionString),
  ].filter(Boolean);

  return parts.join(' ');
}

function toggleUnits(link) {
  link.innerText = convertMillimetersToImperial(link.innerText);
}

// Use a regular expression to find lines starting with a four-digit number
var regex = /\b\d{4}\b/g;
var gauges = document.getElementById('gauges');

gauges.innerHTML = gauges.innerHTML.replace(regex, function (match) {
  var link = document.createElement('a');
    link.href = '#'; // You can set a meaningful href value if needed
    link.innerText = match; // Use the matched number as the link text
    link.class = 'foo()';
    // Add a click event listener to the hyperlink
    link.onclick = function() {
      console.log('cool');
      toggleUnits(link);
    };

    // Return the HTML for the hyperlink
    return '<a onclick="toggleUnits(this)">' + match + '</a>';
}); 
