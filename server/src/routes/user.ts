import express from 'express';
import * as admin from 'firebase-admin';
import { db, isFirebaseInitialized } from '../config/firebase-admin';
import { UserGeoInfo } from '../types/subscription';
import { verifyFirebaseToken } from '../middleware/authMiddleware';

const router = express.Router();

router.use(verifyFirebaseToken);

router.post('/geo-info', async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { country, countryName, paymentProvider, countrySource, detectedAt } = req.body;

    if (!country) {
      return res.status(400).json({
        success: false,
        error: 'country is required',
      });
    }

    if (!isFirebaseInitialized() || !db) {
      return res.status(503).json({
        success: false,
        error: 'Database not available',
      });
    }

    const geoInfo: UserGeoInfo = {
      country: country.toUpperCase(),
      countryName: countryName || country,
      paymentProvider: 'paddle',
      countrySource: countrySource || 'ip',
      detectedAt: detectedAt || new Date().toISOString(),
    };

    await db.collection('users').doc(userId).set(
      {
        geoInfo,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    res.json({ success: true, data: geoInfo });
  } catch (error) {
    console.error('Error saving user geo info:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save geo info',
    });
  }
});

router.get('/geo-info/:userId', async (req, res) => {
  try {
    const userId = req.user!.uid;
    if (req.params.userId !== userId) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    if (!isFirebaseInitialized() || !db) {
      return res.status(503).json({
        success: false,
        error: 'Database not available',
      });
    }

    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.json({ success: true, data: null });
    }

    res.json({ success: true, data: userDoc.data()?.geoInfo || null });
  } catch (error) {
    console.error('Error getting user geo info:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to get geo info',
    });
  }
});

router.post('/billing-country', async (req, res) => {
  try {
    const userId = req.user!.uid;
    const { country, countryName } = req.body;

    if (!country) {
      return res.status(400).json({
        success: false,
        error: 'country is required',
      });
    }

    if (!isFirebaseInitialized() || !db) {
      return res.status(503).json({
        success: false,
        error: 'Database not available',
      });
    }

    const upperCountry = country.toUpperCase();
    const paymentProvider = 'paddle';

    await db.collection('users').doc(userId).set(
      {
        geoInfo: {
          country: upperCountry,
          countryName: countryName || upperCountry,
          paymentProvider,
          countrySource: 'billing',
          detectedAt: new Date().toISOString(),
        },
        billingCountry: upperCountry,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    const subscriptionRef = db.collection('subscriptions').doc(userId);
    const subscriptionDoc = await subscriptionRef.get();
    if (subscriptionDoc.exists) {
      await subscriptionRef.update({
        provider: paymentProvider,
        updatedAt: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      data: {
        country: upperCountry,
        paymentProvider,
      },
    });
  } catch (error) {
    console.error('Error updating billing country:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to update billing country',
    });
  }
});

export default router;
