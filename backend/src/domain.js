export const COMMON_SKILLS = ['Mechanical', 'Electrical', 'Instrumentation', 'Troubleshooting', 'Safety', 'Data interpretation'];

export const ISSUE_TYPES = {
  unexpected_breakdown: {
    label: 'Unexpected Machine Breakdown',
    preferredSkills: ['Fault Diagnosis', 'Electrical Fault Diagnosis', 'Mechanical Troubleshooting', 'Circuit Reading', 'Component Replacement', 'PLC Troubleshooting']
  },
  overheating: {
    label: 'Overheating',
    preferredSkills: ['Thermal Inspection', 'Motor Diagnostics', 'Lubrication & Bearing Inspection', 'Cooling-System Maintenance', 'Overload & Temperature Detection']
  },
  excessive_vibration: {
    label: 'Excessive Vibration',
    preferredSkills: ['Vibration Analysis', 'Bearing Diagnostics', 'Shaft Alignment', 'Machine Balancing', 'Gear & Rotating-Equipment Inspection']
  }
};

export const TECHNICIANS = [
  ['OH-T001', 'Suresh Kumar', 'Ambattur Industrial Estate', 'Thermal Inspection', 9.3, 'overheating'],
  ['OH-T002', 'Naveen Raj', 'Guindy', 'Motor Diagnostics', 8.8, 'overheating'],
  ['OH-T003', 'Praveen S.', 'Sriperumbudur', 'Cooling-System Maintenance', 9.4, 'overheating'],
  ['OH-T004', 'Manoj Kumar', 'Oragadam', 'Lubrication & Bearing Inspection', 9.0, 'overheating'],
  ['OH-T005', 'Ajay Joseph', 'Padi', 'Overload & Temperature Detection', 8.6, 'overheating'],
  ['MB-T001', 'Arun Kumar', 'Ambattur Industrial Estate', 'Mechanical Troubleshooting', 9.2, 'unexpected_breakdown'],
  ['MB-T002', 'Vikram Raj', 'Padi', 'Electrical Fault Diagnosis', 8.7, 'unexpected_breakdown'],
  ['MB-T003', 'Karthik S.', 'Sriperumbudur', 'PLC Troubleshooting', 9.5, 'unexpected_breakdown'],
  ['MB-T004', 'Rahul Sharma', 'Gummidipoondi', 'Hydraulic & Pneumatic Troubleshooting', 8.9, 'unexpected_breakdown'],
  ['MB-T005', 'Daniel Joseph', 'Ponneri', 'CNC & Equipment Diagnostics', 9.1, 'unexpected_breakdown'],
  ['EV-T001', 'S. Prakash', 'Ambattur Industrial Estate', 'Vibration Analysis', 9.4, 'excessive_vibration'],
  ['EV-T002', 'Hari Krishnan', 'Guindy', 'Bearing Diagnostics', 8.9, 'excessive_vibration'],
  ['EV-T003', 'Mohan Raj', 'Sriperumbudur', 'Shaft Alignment', 9.2, 'excessive_vibration'],
  ['EV-T004', 'Sanjay Kumar', 'Oragadam', 'Machine Balancing', 9.0, 'excessive_vibration'],
  ['EV-T005', 'Antony Joseph', 'Padi', 'Gear & Rotating-Equipment Inspection', 8.7, 'excessive_vibration']
].map(([technicianId, name, site, skillFocus, rating, issueType]) => ({ technicianId, name, site, skillFocus, rating, issueType, skills: [...COMMON_SKILLS, skillFocus] }));
