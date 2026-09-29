import type { Metadata } from 'next';
import { ScanReportView } from '@/components/report/ScanReportView';

export const metadata: Metadata = {
  title: 'Scan report',
  description:
    'A Warrant scan result: attack-stop and benign-pass together. The numbers are in the link.',
};

export default function ReportPage() {
  return <ScanReportView />;
}
