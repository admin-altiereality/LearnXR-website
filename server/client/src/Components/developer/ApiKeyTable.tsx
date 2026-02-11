/**
 * API Key Table Component
 * Displays and manages user's API keys
 * Redesigned with editorial, technical aesthetic
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FaKey, FaTrash, FaSync, FaLock, FaUnlock, FaClock } from 'react-icons/fa';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-toastify';
import { ApiKeyListItem, revokeApiKey, regenerateApiKey } from '../../services/apiKeyService';
import { ApiKeyScope } from '../../types/apiKey';
import { formatRelativeTime, formatDateWithRelative } from '../../utils/relativeTime';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';

interface ApiKeyTableProps {
  apiKeys: ApiKeyListItem[];
  onRefresh: () => void;
  onKeyRegenerated: (response: any) => void;
}

const ApiKeyTable: React.FC<ApiKeyTableProps> = ({
  apiKeys,
  onRefresh,
  onKeyRegenerated
}) => {
  const [loadingKeyId, setLoadingKeyId] = useState<string | null>(null);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return formatDateWithRelative(dateString, true);
  };

  const handleRevoke = async (keyId: string) => {
    setLoadingKeyId(keyId);
    try {
      await revokeApiKey(keyId);
      toast.success('API key revoked successfully');
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to revoke API key');
    } finally {
      setLoadingKeyId(null);
      setConfirmRevokeId(null);
    }
  };

  const handleRegenerate = async (keyId: string) => {
    setLoadingKeyId(keyId);
    try {
      const response = await regenerateApiKey(keyId);
      toast.success('API key regenerated');
      onKeyRegenerated(response);
      onRefresh();
    } catch (error: any) {
      toast.error(error.message || 'Failed to regenerate API key');
    } finally {
      setLoadingKeyId(null);
    }
  };

  const activeKeys = apiKeys.filter(k => !k.revoked);
  const revokedKeys = apiKeys.filter(k => k.revoked);

  if (apiKeys.length === 0) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <Card className="border-border">
          <CardContent className="text-center py-16 px-4">
            <div className="w-20 h-20 rounded-full bg-muted border border-border flex items-center justify-center mx-auto mb-6">
              <FaKey className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-bold text-foreground mb-3">No API Keys Yet</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Create your first API key to start integrating In3D's generation capabilities into your applications.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8 md:space-y-10">
      {/* Active Keys */}
      {activeKeys.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 bg-primary rounded-full" />
            <h3 className="text-sm uppercase tracking-wider font-semibold text-foreground">Active Keys</h3>
            <Badge variant="secondary">{activeKeys.length}</Badge>
          </div>
          <div className="space-y-3 md:space-y-4">
            {activeKeys.map((key, index) => (
              <motion.div
                key={key.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05, duration: 0.4 }}
              >
                <Card className="border-border bg-card hover:border-primary/50 transition-colors group">
                  <CardContent className="p-5 md:p-6">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 md:gap-6">
                      <div className="flex-1 min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <h4 className="text-lg font-bold text-foreground">{key.label}</h4>
                          <Badge variant={key.scope === ApiKeyScope.FULL ? 'default' : 'secondary'} className="text-xs uppercase">
                            {key.scope === ApiKeyScope.FULL ? (
                              <span className="flex items-center gap-1.5">
                                <FaUnlock className="w-2.5 h-2.5" />
                                Full Access
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5">
                                <FaLock className="w-2.5 h-2.5" />
                                Read Only
                              </span>
                            )}
                          </Badge>
                        </div>
                        <div className="font-mono text-sm text-muted-foreground bg-muted px-3 py-2 rounded-md border border-border inline-block">
                          {key.keyPrefix}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-muted-foreground">
                          <span className="flex items-center gap-2">
                            <FaClock className="w-3 h-3" />
                            Created {formatDate(key.createdAt)}
                          </span>
                          <span className="flex items-center gap-2">
                            <FaClock className="w-3 h-3" />
                            Last used {formatRelativeTime(key.lastUsedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 lg:flex-shrink-0">
                        {confirmRevokeId === key.id ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="flex items-center gap-2 p-2 rounded-lg bg-destructive/10 border border-destructive/30"
                          >
                            <span className="text-xs text-destructive font-medium uppercase">Confirm?</span>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRevoke(key.id)}
                              disabled={loadingKeyId === key.id}
                            >
                              Yes
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setConfirmRevokeId(null)}
                            >
                              No
                            </Button>
                          </motion.div>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => handleRegenerate(key.id)}
                              disabled={loadingKeyId === key.id}
                              title="Regenerate key"
                            >
                              {loadingKeyId === key.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <FaSync className="w-4 h-4" />
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setConfirmRevokeId(key.id)}
                              disabled={loadingKeyId === key.id}
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              title="Revoke key"
                            >
                              <FaTrash className="w-4 h-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Revoked Keys */}
      {revokedKeys.length > 0 && (
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="w-1 h-6 bg-destructive/50 rounded-full" />
            <h3 className="text-sm uppercase tracking-wider font-semibold text-muted-foreground">Revoked Keys</h3>
            <Badge variant="outline" className="text-muted-foreground">{revokedKeys.length}</Badge>
          </div>
          <div className="space-y-2">
            {revokedKeys.map((key) => (
              <Card key={key.id} className="border-border bg-muted/30 opacity-80">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground line-through">{key.label}</span>
                      <Badge variant="destructive" className="text-xs">Revoked</Badge>
                    </div>
                    <span className="font-mono text-xs text-muted-foreground">{key.keyPrefix}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApiKeyTable;
