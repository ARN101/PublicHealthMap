/**
 * Bangladesh 64 districts with HQ city, parent division, approx lat/lng.
 * Used by seed-demo-data.js (city stores district HQ; no DISTRICT column in schema).
 */
module.exports = [
  // Dhaka division (13)
  { district: 'Dhaka', division: 'Dhaka', lat: 23.8103, lng: 90.4125, flagship: 'HOSP-1001-DHK', flagshipName: 'Dhaka Medical College Hospital' },
  { district: 'Faridpur', division: 'Dhaka', lat: 23.6070, lng: 89.8420 },
  { district: 'Gazipur', division: 'Dhaka', lat: 24.0023, lng: 90.4260 },
  { district: 'Gopalganj', division: 'Dhaka', lat: 23.0051, lng: 89.8266 },
  { district: 'Kishoreganj', division: 'Dhaka', lat: 24.4449, lng: 90.7760 },
  { district: 'Madaripur', division: 'Dhaka', lat: 23.1641, lng: 90.1897 },
  { district: 'Manikganj', division: 'Dhaka', lat: 23.8617, lng: 90.0000 },
  { district: 'Munshiganj', division: 'Dhaka', lat: 23.5422, lng: 90.5305 },
  { district: 'Narayanganj', division: 'Dhaka', lat: 23.6238, lng: 90.5000 },
  { district: 'Narsingdi', division: 'Dhaka', lat: 23.9322, lng: 90.7150 },
  { district: 'Rajbari', division: 'Dhaka', lat: 23.7574, lng: 89.6440 },
  { district: 'Shariatpur', division: 'Dhaka', lat: 23.2423, lng: 90.4348 },
  { district: 'Tangail', division: 'Dhaka', lat: 24.2513, lng: 89.9167 },

  // Chittagong / Chattogram division (11)
  { district: 'Chattogram', division: 'Chittagong', lat: 22.3569, lng: 91.7832, flagship: 'HOSP-1002-CTG', flagshipName: 'Chittagong Medical College Hospital' },
  { district: 'Bandarban', division: 'Chittagong', lat: 22.1953, lng: 92.2183 },
  { district: 'Brahmanbaria', division: 'Chittagong', lat: 23.9571, lng: 91.1115 },
  { district: 'Chandpur', division: 'Chittagong', lat: 23.2513, lng: 90.6720 },
  { district: 'Cumilla', division: 'Chittagong', lat: 23.4607, lng: 91.1809 },
  { district: 'Coxs Bazar', division: 'Chittagong', lat: 21.4272, lng: 92.0058 },
  { district: 'Feni', division: 'Chittagong', lat: 23.0159, lng: 91.3976 },
  { district: 'Khagrachhari', division: 'Chittagong', lat: 23.1193, lng: 91.9847 },
  { district: 'Lakshmipur', division: 'Chittagong', lat: 22.9447, lng: 90.8412 },
  { district: 'Noakhali', division: 'Chittagong', lat: 22.8696, lng: 91.0995 },
  { district: 'Rangamati', division: 'Chittagong', lat: 22.7324, lng: 92.2985 },

  // Rajshahi division (8)
  { district: 'Rajshahi', division: 'Rajshahi', lat: 24.3745, lng: 88.6042, flagship: 'HOSP-1008-RAJ', flagshipName: 'Rajshahi Medical College Hospital' },
  { district: 'Bogura', division: 'Rajshahi', lat: 24.8465, lng: 89.3772 },
  { district: 'Joypurhat', division: 'Rajshahi', lat: 25.0968, lng: 89.0227 },
  { district: 'Naogaon', division: 'Rajshahi', lat: 24.7936, lng: 88.9318 },
  { district: 'Natore', division: 'Rajshahi', lat: 24.4206, lng: 89.0000 },
  { district: 'Chapainawabganj', division: 'Rajshahi', lat: 24.5965, lng: 88.2775 },
  { district: 'Pabna', division: 'Rajshahi', lat: 24.0064, lng: 89.2372 },
  { district: 'Sirajganj', division: 'Rajshahi', lat: 24.4534, lng: 89.7007 },

  // Khulna division (10)
  { district: 'Khulna', division: 'Khulna', lat: 22.8456, lng: 89.5403, flagship: 'HOSP-1004-KHN', flagshipName: 'Khulna Medical College Hospital' },
  { district: 'Bagerhat', division: 'Khulna', lat: 22.6602, lng: 89.7895 },
  { district: 'Chuadanga', division: 'Khulna', lat: 23.6402, lng: 88.8415 },
  { district: 'Jashore', division: 'Khulna', lat: 23.1667, lng: 89.2083 },
  { district: 'Jhenaidah', division: 'Khulna', lat: 23.5448, lng: 89.1531 },
  { district: 'Kushtia', division: 'Khulna', lat: 23.9013, lng: 89.1200 },
  { district: 'Magura', division: 'Khulna', lat: 23.4873, lng: 89.4190 },
  { district: 'Meherpur', division: 'Khulna', lat: 23.7622, lng: 88.6318 },
  { district: 'Narail', division: 'Khulna', lat: 23.1725, lng: 89.5120 },
  { district: 'Satkhira', division: 'Khulna', lat: 22.7185, lng: 89.0705 },

  // Barisal division (6)
  { district: 'Barishal', division: 'Barisal', lat: 22.7010, lng: 90.3535, flagship: 'HOSP-1005-BAR', flagshipName: 'Sher-e-Bangla Medical College Hospital' },
  { district: 'Barguna', division: 'Barisal', lat: 22.0953, lng: 90.1121 },
  { district: 'Bhola', division: 'Barisal', lat: 22.6854, lng: 90.6482 },
  { district: 'Jhalokathi', division: 'Barisal', lat: 22.6406, lng: 90.1987 },
  { district: 'Patuakhali', division: 'Barisal', lat: 22.3596, lng: 90.3299 },
  { district: 'Pirojpur', division: 'Barisal', lat: 22.5791, lng: 89.9750 },

  // Sylhet division (4)
  { district: 'Sylhet', division: 'Sylhet', lat: 24.8949, lng: 91.8687, flagship: 'HOSP-1003-SYL', flagshipName: 'Sylhet MAG Osmani Medical College Hospital' },
  { district: 'Habiganj', division: 'Sylhet', lat: 24.3740, lng: 91.4150 },
  { district: 'Moulvibazar', division: 'Sylhet', lat: 24.4826, lng: 91.7774 },
  { district: 'Sunamganj', division: 'Sylhet', lat: 25.0658, lng: 91.3950 },

  // Rangpur division (8)
  { district: 'Rangpur', division: 'Rangpur', lat: 25.7439, lng: 89.2752, flagship: 'HOSP-1006-RGP', flagshipName: 'Rangpur Medical College Hospital' },
  { district: 'Dinajpur', division: 'Rangpur', lat: 25.6217, lng: 88.6354 },
  { district: 'Gaibandha', division: 'Rangpur', lat: 25.3297, lng: 89.5430 },
  { district: 'Kurigram', division: 'Rangpur', lat: 25.8072, lng: 89.6295 },
  { district: 'Lalmonirhat', division: 'Rangpur', lat: 25.9170, lng: 89.4500 },
  { district: 'Nilphamari', division: 'Rangpur', lat: 25.9310, lng: 88.8560 },
  { district: 'Panchagarh', division: 'Rangpur', lat: 26.3411, lng: 88.5542 },
  { district: 'Thakurgaon', division: 'Rangpur', lat: 26.0336, lng: 88.4616 },

  // Mymensingh division (4)
  { district: 'Mymensingh', division: 'Mymensingh', lat: 24.7471, lng: 90.4203, flagship: 'HOSP-1007-MYM', flagshipName: 'Mymensingh Medical College Hospital' },
  { district: 'Jamalpur', division: 'Mymensingh', lat: 24.9375, lng: 89.9370 },
  { district: 'Netrokona', division: 'Mymensingh', lat: 24.8700, lng: 90.7270 },
  { district: 'Sherpur', division: 'Mymensingh', lat: 25.0205, lng: 90.0153 }
];
