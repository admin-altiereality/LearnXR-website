"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFirebaseInitialized = exports.db = void 0;
const app_1 = require("firebase-admin/app");
const firestore_1 = require("firebase-admin/firestore");
const dotenv_1 = __importDefault(require("dotenv"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
// Load environment variables from server directory
const envPath = path_1.default.resolve(__dirname, '../../.env');
console.log('Attempting to load .env from:', envPath);
console.log('Does .env file exist?', fs_1.default.existsSync(envPath));
dotenv_1.default.config({ path: envPath });
// Debug environment variables
console.log('Environment variables after loading:');
console.log('FIREBASE_PROJECT_ID:', process.env.FIREBASE_PROJECT_ID);
console.log('FIREBASE_CLIENT_EMAIL:', process.env.FIREBASE_CLIENT_EMAIL);
console.log('FIREBASE_PRIVATE_KEY exists:', !!process.env.FIREBASE_PRIVATE_KEY);
let firebaseInitialized = false;
try {
    // Initialize Firebase Admin with individual credentials
    const serviceAccount = {
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    };
    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
        console.warn('⚠️  Firebase credentials not found. Firebase features will be disabled.');
        console.warn('   To enable Firebase features, set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY environment variables.');
    }
    else {
        (0, app_1.initializeApp)({
            credential: (0, app_1.cert)(serviceAccount)
        });
        firebaseInitialized = true;
        console.log('✅ Firebase Admin initialized successfully');
    }
}
catch (error) {
    console.error('❌ Failed to initialize Firebase Admin:', error);
    console.warn('⚠️  Firebase features will be disabled.');
}
exports.db = firebaseInitialized ? (0, firestore_1.getFirestore)() : null;
const isFirebaseInitialized = () => firebaseInitialized;
exports.isFirebaseInitialized = isFirebaseInitialized;
