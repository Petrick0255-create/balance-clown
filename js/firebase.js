import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCcFiOtX9S9dTdwoqyfa-bPF4hvJpYGOhs",
  authDomain: "ranking1-929f6.firebaseapp.com",
  projectId: "ranking1-929f6",
  storageBucket: "ranking1-929f6.firebasestorage.app",
  messagingSenderId: "917283988243",
  appId: "1:917283988243:web:b7e4e4304331b09406b0e6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function getWeekKey() {
  const now = new Date();

  const firstDay = new Date(now.getFullYear(), 0, 1);

  const dayOfYear =
    Math.floor((now - firstDay) / 86400000) + 1;

  const week =
    Math.ceil(dayOfYear / 7);

  return `${now.getFullYear()}-W${week}`;
}

export async function saveScore({
  score,
  stageId,
  characterId,
  name = ""
}) {

  await addDoc(
    collection(db, "clown-rankings"),
    {
      score: Number(score),
      stageId,
      characterId,
      name,
      weekKey: getWeekKey(),
      createdAt: serverTimestamp()
    }
  );
}

export async function getTop5(stageId) {

  const q = query(
    collection(db, "clown-rankings"),
    where("weekKey", "==", getWeekKey()),
    where("stageId", "==", stageId),
    orderBy("score", "desc"),
    limit(5)
  );

  const snapshot = await getDocs(q);

  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
}