// Tanda air identitas peserta di atas soal. Screenshot di HP tidak bisa diblokir browser,
// jadi gambar yang bocor setidaknya bisa dilacak ke pemilik akunnya.
export default function Watermark({ lines }) {
  const text = lines.filter(Boolean).join(' · ')
  return (
    <div aria-hidden="true" className="fixed inset-0 z-30 pointer-events-none select-none overflow-hidden">
      <div className="absolute -inset-1/2 flex flex-wrap content-start gap-x-16 gap-y-20 -rotate-[24deg] p-8">
        {Array.from({ length: 120 }, (_, i) => (
          <span key={i} className="text-sm font-semibold whitespace-nowrap text-blue-950/[0.08]">{text}</span>
        ))}
      </div>
    </div>
  )
}
