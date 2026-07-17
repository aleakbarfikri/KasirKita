"use client";

export const THERMAL_BLUETOOTH_SERVICES = [
  "000018f0-0000-1000-8000-00805f9b34fb",
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "49535343-fe7d-4ae5-8fa9-9fafd205e455",
  "e7810a71-73ae-499d-8c15-faa9aef0c3f2",
];

type WriteCharacteristic = {
  properties?: { write?: boolean; writeWithoutResponse?: boolean };
  writeValue: (value: BufferSource) => Promise<void>;
  writeValueWithoutResponse?: (value: BufferSource) => Promise<void>;
};
type ThermalServer = { getPrimaryServices: () => Promise<Array<{ getCharacteristics: () => Promise<WriteCharacteristic[]> }>> };
type ThermalDevice = { id?: string; name?: string; gatt?: { connect: () => Promise<ThermalServer> } };
type BluetoothApi = {
  requestDevice: (options: unknown) => Promise<ThermalDevice>;
  getDevices?: () => Promise<ThermalDevice[]>;
};

const PRINTER_ID_KEY = "kasirkita:thermal-printer-id";
let activeDevice: ThermalDevice | null = null;

function bluetoothApi() {
  return (navigator as Navigator & { bluetooth?: BluetoothApi }).bluetooth;
}

function savedPrinterId() {
  try { return window.localStorage.getItem(PRINTER_ID_KEY); } catch { return null; }
}

function remember(device: ThermalDevice) {
  activeDevice = device;
  if (device.id) {
    try { window.localStorage.setItem(PRINTER_ID_KEY, device.id); } catch { /* storage may be disabled */ }
  }
}

async function writableCharacteristic(device: ThermalDevice) {
  const server = await device.gatt?.connect();
  if (!server) throw new Error("Printer Bluetooth tidak bisa dihubungkan.");
  const services = await server.getPrimaryServices();
  for (const service of services) {
    const characteristics = await service.getCharacteristics();
    const writable = characteristics.find((item) => item.properties?.writeWithoutResponse || item.properties?.write);
    if (writable) return writable;
  }
  throw new Error("Channel ESC/POS printer tidak ditemukan. Pastikan printer memakai mode Bluetooth BLE.");
}

async function writeChunks(characteristic: WriteCharacteristic, payload: Uint8Array) {
  for (let index = 0; index < payload.length; index += 20) {
    const chunk = payload.slice(index, index + 20);
    if (characteristic.properties?.writeWithoutResponse && characteristic.writeValueWithoutResponse) {
      await characteristic.writeValueWithoutResponse(chunk);
    } else {
      await characteristic.writeValue(chunk);
    }
    await new Promise((resolve) => window.setTimeout(resolve, 14));
  }
}

export function isBluetoothChooserCancelled(error: unknown) {
  const value = error as { name?: unknown; message?: unknown } | null;
  return /NotFoundError|AbortError|cancel+ed|chooser/i.test(`${String(value?.name || "")} ${String(value?.message || "")} ${String(error || "")}`);
}

export async function authorizeAndTestThermalPrinter() {
  const bluetooth = bluetoothApi();
  if (!bluetooth) throw new Error("Printer thermal Bluetooth membutuhkan Chrome atau Android yang mendukung Web Bluetooth.");
  const device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: THERMAL_BLUETOOTH_SERVICES });
  const characteristic = await writableCharacteristic(device);
  const text = new TextEncoder().encode("\x1b@\x1ba\x01KASIRKITA\nPrinter terhubung\n\n\n\n\x1dVB\x00");
  await writeChunks(characteristic, text);
  remember(device);
  return device.name || "Bluetooth";
}

export async function sendToThermalPrinter(payload: Uint8Array, automatic = false) {
  const bluetooth = bluetoothApi();
  if (!bluetooth) throw new Error("Printer thermal Bluetooth membutuhkan Chrome atau Android yang mendukung Web Bluetooth.");

  let device = activeDevice;
  if (!device && automatic) {
    const permitted = bluetooth.getDevices ? await bluetooth.getDevices() : [];
    const storedId = savedPrinterId();
    device = permitted.find((item) => Boolean(storedId) && item.id === storedId)
      || (permitted.length === 1 ? permitted[0] : undefined)
      || null;
    if (!device) throw new Error("Printer belum dipilih. Buka Pengaturan Struk lalu tekan Hubungkan dan tes printer Bluetooth.");
  }
  if (!device) {
    device = await bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: THERMAL_BLUETOOTH_SERVICES });
  }
  const characteristic = await writableCharacteristic(device);
  await writeChunks(characteristic, payload);
  remember(device);
  return device.name || "Bluetooth";
}
