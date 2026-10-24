export type YearValue = '1st' | '2nd' | '3rd' | '4th' | 'PG';
export type CategoryValue = 'General' | 'OBC' | 'SC' | 'ST' | 'EWS';
export type InterestValue = 'scholarships' | 'internships' | 'hackathons' | 'govt schemes';

export const YEAR_OPTIONS: YearValue[] = ['1st', '2nd', '3rd', '4th', 'PG'];
export const CATEGORY_OPTIONS: CategoryValue[] = ['General', 'OBC', 'SC', 'ST', 'EWS'];
export const INCOME_RANGES = [
  'Less than 1 LPA',
  '1-3 LPA',
  '3-5 LPA',
  '5-8 LPA',
  '8-12 LPA',
  'Above 12 LPA',
] as const;
export const INTEREST_OPTIONS: { value: InterestValue; label: string; icon: string }[] = [
  { value: 'scholarships', label: 'Scholarships', icon: 'GraduationCap' },
  { value: 'internships', label: 'Internships', icon: 'Briefcase' },
  { value: 'hackathons', label: 'Hackathons', icon: 'Trophy' },
  { value: 'govt schemes', label: 'Govt Schemes', icon: 'Landmark' },
];

export interface Profile {
  id: string;
  name: string;
  college: string | null;
  branch: string | null;
  year: YearValue | null;
  state: string | null;
  category: CategoryValue | null;
  family_income: string | null;
  cgpa: number | null;
  interests: InterestValue[] | null;
  skills: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface OnboardingData {
  name: string;
  college: string;
  branch: string;
  year: YearValue;
  state: string;
  category: CategoryValue;
  family_income: string;
  cgpa: string;
  interests: InterestValue[];
  skills: string[];
}
