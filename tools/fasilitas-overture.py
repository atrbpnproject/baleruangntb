"""Bale Ruang NTB: bangun data/fasilitas/ntb-overture.json dari Overture Maps Places.

Pemakaian:
  pip install pyarrow
  python tools/fasilitas-overture.py 2026-11-18.0          # unduh dari S3 publik Overture (tanpa akun)
  python tools/fasilitas-overture.py --parquet ntb.parquet   # atau dari hasil unduhan sebelumnya

Hanya baris (row group) parquet yang beririsan dengan kotak NTB yang dibaca, jadi unduhan kecil.
Kategori yang disimpan: pendidikan, kesehatan, ibadah, belanja & pasar, pemerintahan.
"""
import json, re, sys, datetime

BBOX = (115.7, -9.25, 119.5, -7.9)  # xmin, ymin, xmax, ymax (NTB + laut sekitar)
MIN_CONFIDENCE = 0.2  # banyak sekolah/kantor desa di NTB punya skor rendah (mis. SDN 1 Giri Tembesi 0,39)
GROUPS = ['edu', 'health', 'worship', 'market', 'gov']
TYPES = []


def tid(label):
    if label not in TYPES:
        TYPES.append(label)
    return TYPES.index(label)


def classify(hier, name):
    h = hier or ''
    n = name or ''
    # Nama yang jelas menunjukkan jenis fasilitas lebih andal daripada kategori Overture (yang kadang kosong/keliru).
    if re.match(r'^pasar\b', n, re.I):
        return 'market', 'Pasar'
    if re.match(r'^(masjid|mesjid|mush?oll?a|musala|langgar|surau)\b', n, re.I):
        return 'worship', 'Masjid / musala'
    if re.match(r'^pura\b', n, re.I) and not h.startswith(('accommodation', 'lodging', 'food_and_drink')):
        return 'worship', 'Pura'
    if re.match(r'^(gereja|GKI|GPIB|GBI|HKBP)\b', n, re.I):
        return 'worship', 'Gereja'
    if re.match(r'^(vihara|wihara|klenteng)\b', n, re.I):
        return 'worship', 'Vihara'
    if re.search(r'\b(puskesmas|pustu|polindes|poskesdes)\b', n, re.I):
        return 'health', 'Puskesmas/pustu'
    if (not h or h.startswith('health_care')) and re.match(r'^(rumah sakit|RSU?D?|RSIA|RS)\b', n, re.I):
        return 'health', 'Rumah sakit'
    if re.match(r'^kantor (kepala )?(desa|lurah|kelurahan)\b', n, re.I):
        return 'gov', 'Kantor desa/kelurahan'
    if re.match(r'^kantor (camat|kecamatan)\b', n, re.I):
        return 'gov', 'Kantor camat'
    if not h or h.startswith('education'):
        if re.match(r'^(TK|PAUD|RA|KB)\s', n):
            return 'edu', 'TK/PAUD'
        if re.match(r'^(SMPN?|MTSN?|MTs|Madrasah Tsanawiyah)\b', n, re.I):
            return 'edu', 'SMP/MTs'
        if re.match(r'^(SMAN?|SMKN?|MAN?|MAS|Madrasah Aliyah)\b', n, re.I):
            return 'edu', 'SMA/SMK/MA'
        if re.match(r'^(SDN?|MIN?|MIS|UPT\s*SD|Sekolah Dasar|Madrasah Ibtidaiyah)\b', n, re.I):
            return 'edu', 'SD/MI'
        if re.match(r'^(pondok pesantren|ponpes|pesantren)\b', n, re.I):
            return 'edu', 'Madrasah/pesantren'
    if h.startswith('education>place_of_learning'):
        # Nama lebih andal daripada kategori Overture untuk jenjang sekolah di Indonesia.
        if re.match(r'^(TK|PAUD|RA|KB)\b', n, re.I):
            return 'edu', 'TK/PAUD'
        if re.match(r'^(SMPN?|MTSN?|MTs|Madrasah Tsanawiyah)\b', n, re.I):
            return 'edu', 'SMP/MTs'
        if re.match(r'^(SMAN?|SMKN?|MAN?|MAS|Madrasah Aliyah)\b', n, re.I):
            return 'edu', 'SMA/SMK/MA'
        if re.match(r'^(SDN?|MIN?|MIS|UPT\s*SD|SD\s|Sekolah Dasar|Madrasah Ibtidaiyah)\b', n, re.I):
            return 'edu', 'SD/MI'
        if re.search(r'pondok|pesantren|ponpes', n, re.I):
            return 'edu', 'Madrasah/pesantren'
        if 'college_university' in h or re.search(r'universitas|institut|sekolah tinggi|politeknik|akademi|STKIP|STIKES', n, re.I):
            return 'edu', 'Perguruan tinggi'
        if 'preschool' in h:
            return 'edu', 'TK/PAUD'
        if 'elementary_school' in h:
            return 'edu', 'SD/MI'
        if 'middle_school' in h:
            return 'edu', 'SMP/MTs'
        if 'high_school' in h:
            return 'edu', 'SMA/SMK/MA'
        if 'religious_school' in h:
            return 'edu', 'Madrasah/pesantren'
        if h.startswith('education>place_of_learning>school'):
            return 'edu', 'Sekolah'
    if h.startswith('education>place_of_learning>specialty_school>vocational'):
        return 'edu', 'Sekolah kejuruan'
    if h.startswith('health_care>hospital'):
        return 'health', 'Rumah sakit'
    if h.startswith('health_care'):
        if re.search(r'puskesmas|pustu|polindes|poskesdes', n, re.I):
            return 'health', 'Puskesmas/pustu'
        if 'dental' in h:
            return 'health', 'Klinik gigi'
        if 'doctors_office' in h or re.match(r'^(dr\.?|praktek|praktik)\b', n, re.I):
            return 'health', 'Praktik dokter'
        if 'outpatient_care_facility' in h or h == 'health_care':
            return 'health', 'Klinik'
        return None
    if h.startswith('cultural_and_historic>place_of_worship'):
        if 'muslim' in h:
            return 'worship', 'Masjid / musala'
        if 'christian' in h:
            return 'worship', 'Gereja'
        if 'hindu' in h:
            return 'worship', 'Pura'
        if 'buddhist' in h:
            return 'worship', 'Vihara'
        return 'worship', 'Tempat ibadah'
    if h.startswith('shopping>market') or re.match(r'^pasar\b', n, re.I) and h.startswith('shopping'):
        return 'market', 'Pasar'
    if h.startswith('shopping>convenience_store'):
        return 'market', 'Minimarket'
    if h.startswith('shopping>food_and_beverage_store>grocery_store') or h.startswith('shopping>supermarket') or h.startswith('shopping>department_store') or h.startswith('shopping>warehouse_club_store'):
        return 'market', 'Toko kelontong/swalayan'
    if h.startswith('shopping>shopping_mall'):
        return 'market', 'Pusat perbelanjaan'
    if h.startswith('community_and_government>government_office') or h.startswith('community_and_government>public_safety_service>police_station'):
        if 'police' in h:
            return 'gov', 'Kantor polisi'
        if re.search(r'\b(desa|kelurahan|kades|lurah)\b', n, re.I):
            return 'gov', 'Kantor desa/kelurahan'
        if re.search(r'\bcamat|kecamatan\b', n, re.I):
            return 'gov', 'Kantor camat'
        return 'gov', 'Kantor pemerintah'
    return None


def rows_from_s3(release):
    import pyarrow.fs as fs, pyarrow.parquet as pq, pyarrow.compute as pc
    s3 = fs.S3FileSystem(anonymous=True, region='us-west-2')
    base = 'overturemaps-us-west-2/release/%s/theme=places/type=place/' % release
    x0, y0, x1, y1 = BBOX
    for info in s3.get_file_info(fs.FileSelector(base)):
        f = pq.ParquetFile(info.path, filesystem=s3)
        md = f.metadata
        idx = {md.schema.column(i).path: i for i in range(md.num_columns)}
        for rg in range(md.num_row_groups):
            r = md.row_group(rg)
            xs, ys = r.column(idx['bbox.xmin']).statistics, r.column(idx['bbox.ymin']).statistics
            if xs is not None and ys is not None and xs.has_min_max and (xs.max < x0 or xs.min > x1 or ys.max < y0 or ys.min > y1):
                continue
            t = f.read_row_group(rg, columns=['id', 'names', 'taxonomy', 'confidence', 'operating_status', 'bbox'])
            for row in t.to_pylist():
                b = row['bbox']
                if x0 <= b['xmin'] <= x1 and y0 <= b['ymin'] <= y1:
                    tx = row['taxonomy'] or {}
                    yield {'id': row['id'], 'name': (row['names'] or {}).get('primary'), 'hier': '>'.join(tx.get('hierarchy') or []),
                           'conf': row['confidence'], 'status': row['operating_status'], 'x': b['xmin'], 'y': b['ymin']}


def rows_from_parquet(path):
    import pyarrow.parquet as pq
    for row in pq.read_table(path).to_pylist():
        yield row


def main():
    args = sys.argv[1:]
    if args[:1] == ['--parquet']:
        rows, release = rows_from_parquet(args[1]), (args[2] if len(args) > 2 else 'lokal')
    else:
        release = args[0]
        rows = rows_from_s3(release)
    items, seen = [], set()
    for r in rows:
        if not r.get('name') or (r.get('conf') or 0) < MIN_CONFIDENCE or r.get('status') in ('permanently_closed', 'temporarily_closed', 'closed'):
            continue
        c = classify(r.get('hier'), r['name'])
        if not c:
            continue
        key = (c[0], r['name'].strip().lower(), round(r['x'], 3), round(r['y'], 3))
        if key in seen:
            continue
        seen.add(key)
        items.append([round(r['x'], 5), round(r['y'], 5), GROUPS.index(c[0]), tid(c[1]), r['name'].strip()])
    items.sort(key=lambda i: (i[1], i[0]))
    out = {'source': 'Overture Maps Foundation, Places (CDLA-Permissive-2.0 / ODbL sesuai sumber)', 'release': release,
           'built': datetime.date.today().isoformat(), 'bbox': BBOX, 'groups': GROUPS, 'types': TYPES,
           'fields': ['lng', 'lat', 'group', 'type', 'name'], 'items': items}
    with open('data/fasilitas/ntb-overture.json', 'w', encoding='utf-8') as fh:
        json.dump(out, fh, ensure_ascii=False, separators=(',', ':'))
    from collections import Counter
    print(len(items), 'fasilitas;', Counter(GROUPS[i[2]] for i in items))


if __name__ == '__main__':
    main()
