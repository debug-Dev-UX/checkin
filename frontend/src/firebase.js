import { initializeApp } from 'firebase/app'
import { getFirestore } from 'firebase/firestore'

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyCSYt2h2ReeIzE5aPrrxVRgST78R32tU2s",
  authDomain: "group-one-usea.firebaseapp.com",
  projectId: "group-one-usea",
  storageBucket: "group-one-usea.firebasestorage.app",
  messagingSenderId: "66329614349",
  appId: "1:66329614349:web:588654aa47b9b556eedd44",
  measurementId: "G-T8BH0LXZFK"
}

// Initialize Firebase
export const app = initializeApp(firebaseConfig)
export const db = getFirestore(app)
