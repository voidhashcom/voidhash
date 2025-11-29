export function RowLayoutRenderer({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row'
      }}
    >
      {children}
    </div>
  );
}
