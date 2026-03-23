CREATE TABLE IF NOT EXISTS public.expense_data (
  id SMALLINT PRIMARY KEY CHECK (id = 1),
  event_name TEXT NOT NULL,
  reference_total INTEGER NOT NULL CHECK (reference_total >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  items JSONB NOT NULL DEFAULT '[]'::jsonb
);

INSERT INTO public.expense_data (id, event_name, reference_total, updated_at, items)
VALUES (
  1,
  'Rincian Biaya Lamaran Af&Zah',
  18000000,
  NOW(),
  '[
    {"id":"bensin","title":"Bensin","unitCost":800000,"quantity":2,"note":"Avanza (PP)","paid":false},
    {"id":"tol","title":"Tol","unitCost":900000,"quantity":2,"note":"Estimasi pulang-pergi","paid":false},
    {"id":"makan-berat","title":"Makan Berat (1 Orang)","unitCost":100000,"quantity":10,"note":"10 x 100.000","paid":false},
    {"id":"oleh-oleh","title":"Oleh-oleh (Bandung)","unitCost":1000000,"quantity":1,"note":"Kurang lebih","paid":false},
    {"id":"penginapan","title":"Penginapan","unitCost":200000,"quantity":12,"note":"4 kamar x 3 malam (Jumat, Sabtu, Minggu)","paid":false},
    {"id":"cincin","title":"Cincin (Tunangan)","unitCost":3500000,"quantity":1,"note":"","paid":false},
    {"id":"dana-darurat","title":"Dana Darurat","unitCost":3000000,"quantity":1,"note":"","paid":false}
  ]'::jsonb
)
ON CONFLICT (id) DO NOTHING;
