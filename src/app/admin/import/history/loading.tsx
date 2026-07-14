import { PageHeaderSkeleton, TableSkeleton } from '@/components/ui/loading-primitives'

export default function AdminImportHistoryLoading() {
  return (
    <div className="space-y-6">
      <PageHeaderSkeleton withActions />
      <TableSkeleton
        columns={[
          'Date',
          'Filename',
          'Mode',
          'Uploaded by',
          'Created',
          'Updated',
          'Unchanged',
          'Rejected',
          'Assets uploaded',
          'Assets rejected',
          'Status',
        ]}
      />
    </div>
  )
}
