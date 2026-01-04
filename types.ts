
export interface DiaryEntry {
  id: string;
  date: string;
  content: string;
  feedback: string;
  mood: string;
  images?: string[]; // Base64 encoded images
}

export interface UserProfile {
  name: string;
  personality: 'supportive' | 'strict' | 'philosophical' | 'custom';
  profilePicture?: string; // Base64 or URL
  customInstruction?: string; // Custom instruction for AI when personality is 'custom'
}

export type TabType = 'record' | 'history' | 'mypage';
