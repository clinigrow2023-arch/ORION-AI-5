export enum Sender {
  User = 'user',
  Bot = 'bot'
}

export interface Message {
  id: string;
  text: string;
  sender: Sender;
  timestamp: Date;
}

export interface PlanStep {
  stepNumber: number;
  title: string;
  description: string;
  duration: string;
}

export interface MessageTemplate {
  situation: string;
  text: string;
  timing: string;
}

export interface ActionPlan {
  diagnosis: string;
  steps: PlanStep[];
  messageTemplates: MessageTemplate[];
  dos: string[];
  donts: string[];
  distancingStrategy: string;
  neurologicalTriggers: string;
}

export type ViewState = 'chat' | 'plan' | 'guide' | 'support';