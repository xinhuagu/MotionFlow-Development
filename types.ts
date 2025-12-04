export enum SystemStatus {
  IDLE = 'IDLE',
  LISTENING = 'LISTENING',
  PROCESSING = 'PROCESSING',
  EXECUTING = 'EXECUTING',
  ERROR = 'ERROR'
}

export interface LogEntry {
  id: string;
  timestamp: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'cmd';
}

export interface MetricData {
  name: string;
  value: number;
}

export interface DeploymentState {
  environment: 'production' | 'staging' | 'dev';
  status: 'healthy' | 'deploying' | 'rollback' | 'failed';
  version: string;
  uptime: string;
}
