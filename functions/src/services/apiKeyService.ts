/**
 * API Key Service
 * Handles all API key business logic and database operations
 */

import * as admin from 'firebase-admin';
import {
  ApiKey,
  ApiKeyScope,
  CreateApiKeyRequest,
  CreateApiKeyResponse,
  ApiKeyListItem,
  ValidatedApiKeyUser
} from '../types/apiKey';
import {
  generateApiKey,
  extractKeyPrefix,
  hashApiKey,
  verifyApiKey,
  isValidApiKeyFormat
} from '../utils/crypto';

const API_KEYS_COLLECTION = 'api_keys';
const USERS_COLLECTION = 'users';

/**
 * Get Firestore database instance
 */
function getDb() {
  return admin.firestore();
}

/**
 * Create a new API key for a user
 */
export async function createApiKey(
  userId: string,
  request: CreateApiKeyRequest
): Promise<CreateApiKeyResponse> {
  const db = getDb();

  // Validate request
  if (!request.label || request.label.trim().length === 0) {
    throw new Error('Label is required');
  }

  if (!Object.values(ApiKeyScope).includes(request.scope)) {
    throw new Error('Invalid scope. Must be "read" or "full"');
  }

  // Check user's existing active keys (limit to 5)
  const existingKeys = await db.collection(API_KEYS_COLLECTION)
    .where('userId', '==', userId)
    .where('revoked', '==', false)
    .get();

  if (existingKeys.size >= 5) {
    throw new Error('Maximum of 5 active API keys allowed. Please revoke an existing key first.');
  }

  // Generate the raw key (shown once to user)
  const rawKey = generateApiKey();
  
  // Hash the key for storage
  const { hash, salt } = await hashApiKey(rawKey);
  
  // Extract prefix for display
  const keyPrefix = extractKeyPrefix(rawKey);

  // Create API key document
  const apiKeyId = db.collection(API_KEYS_COLLECTION).doc().id;
  const now = new Date().toISOString();

  const apiKeyDoc: ApiKey = {
    id: apiKeyId,
    userId,
    label: request.label.trim(),
    keyHash: hash,
    keySalt: salt,
    keyPrefix,
    scope: request.scope,
    createdAt: now,
    lastUsedAt: null,
    revoked: false,
    metadata: {
      requestCount: 0
    }
  };

  await db.collection(API_KEYS_COLLECTION).doc(apiKeyId).set(apiKeyDoc);

  console.log(`✅ API key created for user ${userId}: ${keyPrefix}`);

  return {
    success: true,
    apiKey: {
      id: apiKeyId,
      label: apiKeyDoc.label,
      keyPrefix,
      scope: request.scope,
      createdAt: now,
      rawKey  // Only time raw key is returned!
    },
    warning: '⚠️ This API key will only be shown once. Please copy and store it securely.'
  };
}

/**
 * List all API keys for a user (without sensitive data)
 */
export async function listApiKeys(userId: string): Promise<ApiKeyListItem[]> {
  const db = getDb();

  try {
    // Try query with orderBy first (requires index)
    const snapshot = await db.collection(API_KEYS_COLLECTION)
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => {
      const data = doc.data() as ApiKey;
      return {
        id: data.id,
        label: data.label,
        keyPrefix: data.keyPrefix,
        scope: data.scope,
        createdAt: data.createdAt,
        lastUsedAt: data.lastUsedAt,
        revoked: data.revoked
      };
    });
  } catch (error: any) {
    // If index doesn't exist yet, fallback to query without orderBy and sort in memory
    if (error.code === 9 || error.message?.includes('index') || error.message?.includes('requires an index')) {
      console.warn('Firestore index not found for api_keys, using fallback query');
      const snapshot = await db.collection(API_KEYS_COLLECTION)
        .where('userId', '==', userId)
        .get();

      const keys = snapshot.docs.map(doc => {
        const data = doc.data() as ApiKey;
        return {
          id: data.id,
          label: data.label,
          keyPrefix: data.keyPrefix,
          scope: data.scope,
          createdAt: data.createdAt,
          lastUsedAt: data.lastUsedAt,
          revoked: data.revoked
        };
      });

      // Sort by createdAt descending in memory
      return keys.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA; // Descending order
      });
    }
    
    // Re-throw if it's a different error
    throw error;
  }
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(userId: string, keyId: string): Promise<void> {
  const db = getDb();

  const keyRef = db.collection(API_KEYS_COLLECTION).doc(keyId);
  const keyDoc = await keyRef.get();

  if (!keyDoc.exists) {
    throw new Error('API key not found');
  }

  const keyData = keyDoc.data() as ApiKey;

  if (keyData.userId !== userId) {
    throw new Error('Unauthorized: You do not own this API key');
  }

  if (keyData.revoked) {
    throw new Error('API key is already revoked');
  }

  await keyRef.update({
    revoked: true,
    revokedAt: new Date().toISOString()
  });

  console.log(`🔒 API key revoked: ${keyData.keyPrefix}`);
}

/**
 * Validate an API key and return user information
 * Used by middleware for API authentication
 */
export async function validateApiKey(rawKey: string): Promise<ValidatedApiKeyUser | null> {
  const db = getDb();

  // Validate format first (quick check)
  if (!isValidApiKeyFormat(rawKey)) {
    console.warn('Invalid API key format');
    return null;
  }

  // Extract prefix to narrow down candidates
  const keyPrefix = extractKeyPrefix(rawKey);

  // Find potential matching keys by prefix
  const snapshot = await db.collection(API_KEYS_COLLECTION)
    .where('keyPrefix', '==', keyPrefix)
    .where('revoked', '==', false)
    .get();

  if (snapshot.empty) {
    console.warn('No matching API key found for prefix:', keyPrefix);
    return null;
  }

  // Verify against each candidate (usually just one)
  for (const doc of snapshot.docs) {
    const keyData = doc.data() as ApiKey;
    
    const isValid = await verifyApiKey(rawKey, keyData.keyHash);
    
    if (isValid) {
      // Update last used timestamp
      await doc.ref.update({
        lastUsedAt: new Date().toISOString(),
        'metadata.requestCount': admin.firestore.FieldValue.increment(1)
      });

      // Fetch user data
      const userDoc = await db.collection(USERS_COLLECTION).doc(keyData.userId).get();
      
      if (!userDoc.exists) {
        console.error('User not found for API key:', keyData.userId);
        return null;
      }

      const userData = userDoc.data();

      // Simplified subscription/credits logic (no payment system)
      // Default to free tier with basic credits
      let subscriptionTier = 'free';
      let creditsRemaining = 100;

      // Check if user has any subscription data (legacy support)
      const subscriptionDoc = await db.collection('subscriptions').doc(keyData.userId).get();
      if (subscriptionDoc.exists) {
        const subData = subscriptionDoc.data();
        subscriptionTier = subData?.planId || subData?.planName?.toLowerCase() || 'free';
        
        if (subData?.usage?.creditsRemaining !== undefined) {
          creditsRemaining = subData.usage.creditsRemaining;
        } else if (subData?.creditsRemaining !== undefined) {
          creditsRemaining = subData.creditsRemaining;
        }
      }

      // Fallback to user document
      if (userData) {
        if (userData.subscriptionTier) {
          subscriptionTier = userData.subscriptionTier;
        } else if (userData.subscriptionStatus) {
          subscriptionTier = userData.subscriptionStatus;
        }
        
        if (userData.creditsRemaining !== undefined) {
          creditsRemaining = userData.creditsRemaining;
        }
      }

      return {
        userId: keyData.userId,
        subscriptionTier,
        creditsRemaining,
        scope: keyData.scope
      };
    }
  }

  return null;
}

/**
 * Regenerate an API key (revokes old, creates new with same label/scope)
 */
export async function regenerateApiKey(
  userId: string,
  keyId: string
): Promise<CreateApiKeyResponse> {
  const db = getDb();

  const keyRef = db.collection(API_KEYS_COLLECTION).doc(keyId);
  const keyDoc = await keyRef.get();

  if (!keyDoc.exists) {
    throw new Error('API key not found');
  }

  const oldKeyData = keyDoc.data() as ApiKey;

  if (oldKeyData.userId !== userId) {
    throw new Error('Unauthorized: You do not own this API key');
  }

  // Revoke the old key
  await keyRef.update({
    revoked: true,
    revokedAt: new Date().toISOString()
  });

  // Create new key with same label and scope
  return createApiKey(userId, {
    label: oldKeyData.label,
    scope: oldKeyData.scope
  });
}
