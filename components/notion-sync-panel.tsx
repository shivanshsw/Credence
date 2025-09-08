'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, CheckCircle, XCircle, RefreshCw, Settings } from 'lucide-react';

interface NotionSyncStatus {
  descope: {
    status: any;
    config: {
      enabled: boolean;
      webhookUrl: string;
      syncInterval: number;
      autoSync: boolean;
    };
  };
  notion: {
    syncResult: {
      tasks: any;
      notes: any;
    };
  };
  lastSync: string;
}

export function NotionSyncPanel() {
  const [status, setStatus] = useState<NotionSyncStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/notion/setup?action=get_status');
      const data = await response.json();
      
      if (data.success) {
        setStatus(data.data);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to fetch status');
    } finally {
      setLoading(false);
    }
  };

  const performFullSync = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/notion/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'full_sync' }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to perform sync');
    } finally {
      setLoading(false);
    }
  };

  const setupIntegration = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/notion/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setup_integration' }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        await fetchStatus();
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError('Failed to setup integration');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Notion Integration Status
        </CardTitle>
        <CardDescription>
          Manage your Notion integration with Descope outbound apps
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex gap-4">
          <Button 
            onClick={fetchStatus} 
            variant="outline" 
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh Status
          </Button>
          
          <Button 
            onClick={performFullSync} 
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Full Sync
          </Button>
          
          <Button 
            onClick={setupIntegration} 
            variant="secondary"
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Settings className="h-4 w-4" />}
            Setup Integration
          </Button>
        </div>

        {status && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Descope Integration</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Status</span>
                    <Badge variant={status.descope.status?.active ? "default" : "secondary"}>
                      {status.descope.status?.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Auto Sync</span>
                    <Switch 
                      checked={status.descope.config.autoSync} 
                      disabled 
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Sync Interval</span>
                    <span className="text-sm text-muted-foreground">
                      {Math.round(status.descope.config.syncInterval / 1000 / 60)} min
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Notion Sync</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Tasks</span>
                    <Badge variant={status.notion.syncResult.tasks.success ? "default" : "destructive"}>
                      {status.notion.syncResult.tasks.success ? "Synced" : "Error"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Notes</span>
                    <Badge variant={status.notion.syncResult.notes.success ? "default" : "destructive"}>
                      {status.notion.syncResult.notes.success ? "Synced" : "Error"}
                    </Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Last Sync</span>
                    <span className="text-sm text-muted-foreground">
                      {new Date(status.lastSync).toLocaleTimeString()}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>

            <Separator />

            <div className="space-y-2">
              <h4 className="text-sm font-medium">Webhook Configuration</h4>
              <div className="bg-muted p-3 rounded-md">
                <code className="text-xs">
                  {status.descope.config.webhookUrl || 'Not configured'}
                </code>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
