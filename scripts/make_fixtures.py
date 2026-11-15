# Generates small synthetic rasters in the exact formats CLIMARIS reads live (for offline tests).
import numpy as np, tifffile, zlib, json, h5py, os
D = os.path.join(os.path.dirname(__file__), 'fixtures')
os.makedirs(D, exist_ok=True)

def geotags(x0, y0, sx, sy, nodata=None, point=False):
    t = [(33550, 'd', 3, (sx, sy, 0.0), False), (33922, 'd', 6, (0.0, 0.0, 0.0, x0, y0, 0.0), False),
         (34735, 'H', 16, (1, 1, 0, 3, 1024, 0, 1, 2, 1025, 0, 1, 2 if point else 1, 2054, 0, 1, 9102), False)]
    if nodata is not None:
        t.append((42113, 's', 0, str(nodata), False))
    return t

# JRC-like COG: 512x512 float32, 256 tiles, deflate + floating-point predictor, nodata -9999
res = 1 / 1200
for rp, dep in {10: 0.2, 20: 0.4, 50: 0.7, 75: 0.85, 100: 1.0, 200: 1.3, 500: 1.8}.items():
    a = np.full((512, 512), -9999, np.float32)
    a[200:330, 300:380] = dep
    tifffile.imwrite(f'{D}/jrc_rp{rp}.tif', a, tile=(256, 256), compression='zlib', predictor=3, extratags=geotags(72.6, 19.3, res, res, -9999))

# subsidence: uncompressed strips, centre masked, neighbours 12 mm/yr
s = np.full((100, 100), 12.0, np.float32)
r, c = int((19.5 - 19.08) / 0.008333), int((72.88 - 72.5) / 0.008333)
s[r, c] = -9999
tifffile.imwrite(f'{D}/subsidence.tif', s, rowsperstrip=1, extratags=geotags(72.5, 19.5, 0.008333, 0.008333, -9999))
tifffile.imwrite(f'{D}/wtd.tif', np.full((60, 60), 8.5, np.float32), rowsperstrip=1, extratags=geotags(70.0, 22.0, 0.0833, 0.0833))
# ILSM-like BigTIFF float64 strips
tifffile.imwrite(f'{D}/ilsm.tif', np.full((100, 100), 0.35, np.float64), rowsperstrip=1, bigtiff=True, extratags=geotags(72.7, 19.2, 0.002, 0.002, 'nan'))

# STORM-like: LZW + horizontal predictor float32 tiles, deflate-raw streams (as stored in the zip)
vals = {'constant_10': 20, 'constant_50': 30, 'constant_100': 35, 'constant_1000': 50, 'CMCC-CM2-VHR4_100': 36, 'CNRM-CM6-1-HR_100': 37, 'EC-Earth3P-HR_100': 34, 'HadGEM3-GC31-HM_100': 38}
import imagecodecs, struct
def storm_tiff(a, x0, y0, sx, sy):
    H, W = a.shape; tw = th = 256
    tiles = []
    for ty in range(0, H, th):
        for tx in range(0, W, tw):
            t = np.zeros((th, tw), np.float32); blk = a[ty:ty + th, tx:tx + tw]; t[:blk.shape[0], :blk.shape[1]] = blk
            u = t.view(np.uint32).astype(np.uint64)
            d = u.copy(); d[:, 1:] = (u[:, 1:] - u[:, :-1]) % (1 << 32)
            tiles.append(imagecodecs.lzw_encode(d.astype(np.uint32).tobytes()))
    n = len(tiles)
    tags = [(256, 3, 1, W), (257, 3, 1, H), (258, 3, 1, 32), (259, 3, 1, 5), (262, 3, 1, 1), (277, 3, 1, 1), (284, 3, 1, 1), (317, 3, 1, 2),
            (322, 3, 1, tw), (323, 3, 1, th), (324, 4, n, None), (325, 4, n, None), (339, 3, 1, 3), (33550, 12, 3, None), (33922, 12, 6, None)]
    ifd_size = 2 + 12 * len(tags) + 4
    extra_off = 8 + ifd_size
    blobs = {324: None, 325: struct.pack('<%dI' % n, *[len(t) for t in tiles]), 33550: struct.pack('<3d', sx, sy, 0), 33922: struct.pack('<6d', 0, 0, 0, x0, y0, 0)}
    order = [325, 33550, 33922, 324]
    offs = {}; cur = extra_off
    for k in order:
        offs[k] = cur; cur += 4 * n if k == 324 else len(blobs[k])
    data_off = cur; to = []
    for t in tiles: to.append(data_off); data_off += len(t)
    blobs[324] = struct.pack('<%dI' % n, *to)
    out = bytearray(b'II*\x00' + struct.pack('<I', 8))
    out += struct.pack('<H', len(tags))
    for tag, typ, cnt, val in tags:
        if val is None: out += struct.pack('<HHII', tag, typ, cnt, offs[tag])
        else: out += struct.pack('<HHIHH', tag, typ, cnt, val, 0)
    out += struct.pack('<I', 0)
    for k in order: out += blobs[k]
    for t in tiles: out += t
    return bytes(out)
for k, v in vals.items():
    a = np.zeros((512, 512), np.float32)
    a[150:300, 150:300] = v
    raw = storm_tiff(a, 50.0, 40.0, 0.1, 0.1)
    co = zlib.compressobj(9, zlib.DEFLATED, -15)
    open(f'{D}/storm_{k}.deflate', 'wb').write(co.compress(raw) + co.flush())

# Deltares-like Zarr chunk: 600x600 float32, numcodecs shuffle (4) + zlib
for item, v in {'2018-0010': 0.3, '2018-0100': 0.6, '2050-0100': 0.9}.items():
    a = np.zeros((600, 600), np.float32)
    a[96, 456] = v
    b = a.tobytes()
    n = len(b) // 4
    sh = bytes(b[i * 4 + k] for k in range(4) for i in range(n))
    open(f'{D}/deltares_{item}.chunk', 'wb').write(zlib.compress(sh, 4))

# WGLC-like netCDF4/HDF5: 1° monthly climatology, strokes km-2 day-1
lat = np.arange(-89.5, 90, 1.0); lon = np.arange(-179.5, 180, 1.0)
d = np.zeros((12, lat.size, lon.size), np.float32)
d[:, (np.abs(lat) < 35)[:], :] = 0.005
d[:, int(19.08 + 90), int(72.88 + 180)] = 0.02
with h5py.File(f'{D}/wglc.nc', 'w') as f:
    f['lat'] = lat; f['lon'] = lon
    ds = f.create_dataset('density', data=d, compression='gzip', chunks=(1, 180, 360))
    ds.attrs['units'] = 'strokes km-2 day-1'
print('ok', sorted(os.listdir(D)))
