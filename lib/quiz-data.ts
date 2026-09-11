export type QuizQuestion = {
  id: string;
  question: { hi: string; en: string };
  options: { hi: string; en: string }[];
  correctIndex: number;
};

export const quizId = "hindi-books-basics";
export const quizTitle = { hi: "हिंदी साहित्य क्विज़", en: "Hindi Literature Quiz" };

export const quizQuestions: QuizQuestion[] = [
  {
    id: "q1",
    question: { hi: "मुंशी प्रेमचंद का असली नाम क्या था?", en: "What was Munshi Premchand's birth name?" },
    options: [
      { hi: "धनपत राय श्रीवास्तव", en: "Dhanpat Rai Srivastava" },
      { hi: "हरिवंश राय बच्चन", en: "Harivansh Rai Bachchan" },
      { hi: "सूर्यकांत त्रिपाठी", en: "Suryakant Tripathi" },
      { hi: "रामधारी सिंह", en: "Ramdhari Singh" },
    ],
    correctIndex: 0,
  },
  {
    id: "q2",
    question: { hi: "\"निराला\" उपनाम किस कवि का था?", en: "\"Nirala\" was the pen name of which poet?" },
    options: [
      { hi: "सूर्यकांत त्रिपाठी", en: "Suryakant Tripathi" },
      { hi: "मैथिलीशरण गुप्त", en: "Maithili Sharan Gupt" },
      { hi: "जयशंकर प्रसाद", en: "Jaishankar Prasad" },
      { hi: "महादेवी वर्मा", en: "Mahadevi Verma" },
    ],
    correctIndex: 0,
  },
  {
    id: "q3",
    question: { hi: "\"गोदान\" उपन्यास के लेखक कौन हैं?", en: "Who wrote the novel \"Godaan\"?" },
    options: [
      { hi: "प्रेमचंद", en: "Premchand" },
      { hi: "भारतेंदु हरिश्चंद्र", en: "Bharatendu Harishchandra" },
      { hi: "अज्ञेय", en: "Agyeya" },
      { hi: "फणीश्वरनाथ रेणु", en: "Phanishwar Nath Renu" },
    ],
    correctIndex: 0,
  },
  {
    id: "q4",
    question: { hi: "छायावाद युग के प्रमुख चार स्तंभ कवियों में शामिल नहीं हैं?", en: "Who is NOT one of the four pillar poets of the Chhayavaad era?" },
    options: [
      { hi: "कबीरदास", en: "Kabirdas" },
      { hi: "जयशंकर प्रसाद", en: "Jaishankar Prasad" },
      { hi: "सूर्यकांत त्रिपाठी 'निराला'", en: "Suryakant Tripathi 'Nirala'" },
      { hi: "महादेवी वर्मा", en: "Mahadevi Verma" },
    ],
    correctIndex: 0,
  },
  {
    id: "q5",
    question: { hi: "राजकमल प्रकाशन की स्थापना किस वर्ष हुई थी?", en: "In which year was Rajkamal Prakashan founded?" },
    options: [
      { hi: "1947", en: "1947" },
      { hi: "1990", en: "1990" },
      { hi: "1965", en: "1965" },
      { hi: "1920", en: "1920" },
    ],
    correctIndex: 0,
  },
  {
    id: "q6",
    question: { hi: "\"मधुशाला\" रचना के कवि कौन हैं?", en: "Who is the poet of \"Madhushala\"?" },
    options: [
      { hi: "हरिवंश राय बच्चन", en: "Harivansh Rai Bachchan" },
      { hi: "रामधारी सिंह दिनकर", en: "Ramdhari Singh Dinkar" },
      { hi: "सुमित्रानंदन पंत", en: "Sumitranandan Pant" },
      { hi: "नागार्जुन", en: "Nagarjun" },
    ],
    correctIndex: 0,
  },
  {
    id: "q7",
    question: { hi: "\"चंद्रकांता\" उपन्यास के लेखक कौन हैं?", en: "Who wrote the novel \"Chandrakanta\"?" },
    options: [
      { hi: "देवकीनंदन खत्री", en: "Devaki Nandan Khatri" },
      { hi: "प्रेमचंद", en: "Premchand" },
      { hi: "भीष्म साहनी", en: "Bhisham Sahni" },
      { hi: "यशपाल", en: "Yashpal" },
    ],
    correctIndex: 0,
  },
  {
    id: "q8",
    question: { hi: "\"रश्मिरथी\" काव्य रचना किसने लिखी?", en: "Who wrote the poetic work \"Rashmirathi\"?" },
    options: [
      { hi: "रामधारी सिंह 'दिनकर'", en: "Ramdhari Singh 'Dinkar'" },
      { hi: "सुभद्रा कुमारी चौहान", en: "Subhadra Kumari Chauhan" },
      { hi: "गोपालदास नीरज", en: "Gopaldas Neeraj" },
      { hi: "केदारनाथ अग्रवाल", en: "Kedarnath Agrawal" },
    ],
    correctIndex: 0,
  },
  {
    id: "q9",
    question: { hi: "आधुनिक हिंदी गद्य के जनक किसे माना जाता है?", en: "Who is regarded as the father of modern Hindi prose?" },
    options: [
      { hi: "भारतेंदु हरिश्चंद्र", en: "Bharatendu Harishchandra" },
      { hi: "तुलसीदास", en: "Tulsidas" },
      { hi: "कबीरदास", en: "Kabirdas" },
      { hi: "सूरदास", en: "Surdas" },
    ],
    correctIndex: 0,
  },
  {
    id: "q10",
    question: { hi: "\"मैला आँचल\" उपन्यास के लेखक कौन हैं?", en: "Who wrote the novel \"Maila Aanchal\"?" },
    options: [
      { hi: "फणीश्वरनाथ रेणु", en: "Phanishwar Nath Renu" },
      { hi: "मोहन राकेश", en: "Mohan Rakesh" },
      { hi: "निर्मल वर्मा", en: "Nirmal Verma" },
      { hi: "कमलेश्वर", en: "Kamleshwar" },
    ],
    correctIndex: 0,
  },
  {
    id: "q11",
    question: { hi: "हिंदी दिवस प्रतिवर्ष किस तारीख़ को मनाया जाता है?", en: "On which date is Hindi Diwas celebrated every year?" },
    options: [
      { hi: "14 सितंबर", en: "14 September" },
      { hi: "26 जनवरी", en: "26 January" },
      { hi: "15 अगस्त", en: "15 August" },
      { hi: "2 अक्टूबर", en: "2 October" },
    ],
    correctIndex: 0,
  },
  {
    id: "q12",
    question: { hi: "\"कामायनी\" महाकाव्य के रचयिता कौन हैं?", en: "Who is the author of the epic poem \"Kamayani\"?" },
    options: [
      { hi: "जयशंकर प्रसाद", en: "Jaishankar Prasad" },
      { hi: "मुंशी प्रेमचंद", en: "Munshi Premchand" },
      { hi: "अमृतलाल नागर", en: "Amritlal Nagar" },
      { hi: "विष्णु प्रभाकर", en: "Vishnu Prabhakar" },
    ],
    correctIndex: 0,
  },
];
