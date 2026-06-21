import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAx7c2vMVzsPtMmlT1-J9UcF92J_sKnRYE",
  authDomain: "blance-hayeon-rankings.firebaseapp.com",
  projectId: "blance-hayeon-rankings",
  storageBucket: "blance-hayeon-rankings.firebasestorage.app",
  messagingSenderId: "866494747318",
  appId: "1:866494747318:web:da1bf6be56cdae85c38c17"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export function getWeekKey() {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 1);
  const day = Math.floor((now - start) / 86400000) + 1;
  const week = Math.ceil(day / 7);
  return `${now.getFullYear()}-W${week}`;
}

export async function saveScore({ score, stageId, characterId, name = "" }) {
  await addDoc(collection(db, "rankings"), {
    score: Number(score),
    stageId,
    characterId,
    name,
    weekKey: getWeekKey(),
    createdAt: serverTimestamp()
  });
}

export async function getTop5(stageId) {
  const weekKey = getWeekKey();
  const snapshot = await getDocs(collection(db, "rankings"));

  return snapshot.docs
    .map(doc => doc.data())
    .filter(item => item.stageId === stageId)
    .filter(item => item.weekKey === weekKey)
    .sort((a, b) => Number(b.score) - Number(a.score))
    .slice(0, 5);
}