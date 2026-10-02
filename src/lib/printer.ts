// Multi-connection ESC/POS Printer utility
// Supports: Bluetooth, WiFi/Network (IPP), USB

export interface MultaRecibo {
  numero: string;
  data: string;
  hora: string;
  agente: string;
  infrator: string;
  documentoId: string;
  matricula: string;
  infracao: string;
  local: string;
  valor: number;
  localPagamento?: string;
}

export type ConnectionType = 'bluetooth' | 'wifi' | 'usb' | 'rede';

function textEncoder(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((acc, a) => acc + a.length, 0);
  const result = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    result.set(a, offset);
    offset += a.length;
  }
  return result;
}

const ESC = 0x1B;
const GS = 0x1D;

function buildReceipt(multa: MultaRecibo): Uint8Array {
  const commands: Uint8Array[] = [];
  commands.push(new Uint8Array([ESC, 0x40]));
  commands.push(new Uint8Array([ESC, 0x61, 0x01]));
  commands.push(new Uint8Array([ESC, 0x45, 0x01]));
  commands.push(textEncoder("CONSELHO MUNICIPAL DA MATOLA\n"));
  commands.push(textEncoder("SISTEMA DE MULTAS - SIGEMM\n"));
  commands.push(new Uint8Array([ESC, 0x45, 0x00]));
  commands.push(textEncoder("================================\n"));
  commands.push(textEncoder("RECIBO DE MULTA\n"));
  commands.push(textEncoder("================================\n"));
  commands.push(new Uint8Array([ESC, 0x61, 0x00]));
  commands.push(textEncoder(`Multa N.: ${multa.numero}\n`));
  commands.push(textEncoder(`Data: ${multa.data}\n`));
  commands.push(textEncoder(`Hora: ${multa.hora}\n`));
  commands.push(textEncoder(`Agente: ${multa.agente}\n`));
  commands.push(textEncoder("--------------------------------\n"));
  commands.push(textEncoder(`Infrator: ${multa.infrator}\n`));
  commands.push(textEncoder(`Doc. ID: ${multa.documentoId}\n`));
  commands.push(textEncoder(`Matricula: ${multa.matricula}\n`));
  commands.push(textEncoder("--------------------------------\n"));
  commands.push(textEncoder(`Infracao: ${multa.infracao}\n`));
  commands.push(textEncoder(`Local: ${multa.local}\n`));
  commands.push(textEncoder("--------------------------------\n"));
  commands.push(new Uint8Array([ESC, 0x45, 0x01]));
  commands.push(textEncoder(`VALOR: ${multa.valor.toFixed(2)} MT\n`));
  commands.push(new Uint8Array([ESC, 0x45, 0x00]));
  commands.push(textEncoder("================================\n"));
  if (multa.localPagamento) {
    commands.push(textEncoder(`Local Pagamento:\n`));
    commands.push(textEncoder(`${multa.localPagamento}\n`));
    commands.push(textEncoder("--------------------------------\n"));
  }
  commands.push(new Uint8Array([ESC, 0x61, 0x01]));
  commands.push(textEncoder("Pague dentro de 15 dias uteis\n"));
  commands.push(textEncoder("para evitar agravamento.\n\n\n"));
  commands.push(new Uint8Array([GS, 0x56, 0x00]));
  return concat(...commands);
}

// ========== Connection State ==========
let printerDevice: any = null;
let printerCharacteristic: any = null;
let currentConnectionType: ConnectionType | null = null;
let networkPrinterUrl: string | null = null;

// ========== Bluetooth ==========
export async function connectBluetooth(): Promise<boolean> {
  try {
    const nav = navigator as any;
    if (!nav.bluetooth) throw new Error("Bluetooth não suportado neste navegador");

    printerDevice = await nav.bluetooth.requestDevice({
      filters: [{ services: ['000018f0-0000-1000-8000-00805f9b34fb'] }],
      optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
    });

    const server = await printerDevice.gatt?.connect();
    if (!server) throw new Error("Falha ao conectar ao dispositivo");

    const service = await server.getPrimaryService('000018f0-0000-1000-8000-00805f9b34fb');
    printerCharacteristic = await service.getCharacteristic('00002af1-0000-1000-8000-00805f9b34fb');
    currentConnectionType = 'bluetooth';
    return true;
  } catch (error) {
    console.error("Erro Bluetooth:", error);
    return false;
  }
}

// ========== WiFi / Network ==========
export async function connectWifi(ipAddress: string, port: number = 9100): Promise<boolean> {
  try {
    networkPrinterUrl = `http://${ipAddress}:${port}`;
    currentConnectionType = 'wifi';
    return true;
  } catch (error) {
    console.error("Erro WiFi:", error);
    return false;
  }
}

export async function connectNetwork(ipAddress: string, port: number = 9100): Promise<boolean> {
  return connectWifi(ipAddress, port);
}

// ========== USB ==========
export async function connectUSB(): Promise<boolean> {
  try {
    const nav = navigator as any;
    if (!nav.usb) throw new Error("WebUSB não suportado neste navegador");

    printerDevice = await nav.usb.requestDevice({ filters: [] });
    await printerDevice.open();
    await printerDevice.selectConfiguration(1);
    await printerDevice.claimInterface(0);
    currentConnectionType = 'usb';
    return true;
  } catch (error) {
    console.error("Erro USB:", error);
    return false;
  }
}

// ========== Generic Connect ==========
export async function connectPrinter(type: ConnectionType = 'bluetooth', config?: { ip?: string; port?: number }): Promise<boolean> {
  switch (type) {
    case 'bluetooth': return connectBluetooth();
    case 'wifi': return connectWifi(config?.ip ?? '192.168.1.100', config?.port);
    case 'rede': return connectNetwork(config?.ip ?? '192.168.1.100', config?.port);
    case 'usb': return connectUSB();
    default: return false;
  }
}

// ========== Print ==========
async function printViaBluetooth(data: Uint8Array): Promise<boolean> {
  if (!printerCharacteristic) return false;
  const chunkSize = 20;
  for (let i = 0; i < data.length; i += chunkSize) {
    await printerCharacteristic.writeValue(data.slice(i, i + chunkSize));
    await new Promise(r => setTimeout(r, 50));
  }
  return true;
}

async function printViaNetwork(data: Uint8Array): Promise<boolean> {
  if (!networkPrinterUrl) return false;
  try {
    await fetch(networkPrinterUrl, {
      method: 'POST',
      body: new Blob([new Uint8Array(data)]),
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    return true;
  } catch {
    console.error("Erro ao imprimir via rede");
    return false;
  }
}

async function printViaUSB(data: Uint8Array): Promise<boolean> {
  if (!printerDevice) return false;
  try {
    await printerDevice.transferOut(1, data);
    return true;
  } catch {
    console.error("Erro ao imprimir via USB");
    return false;
  }
}

export async function printReceipt(multa: MultaRecibo): Promise<boolean> {
  try {
    if (!currentConnectionType) {
      const connected = await connectBluetooth();
      if (!connected) return false;
    }

    const data = buildReceipt(multa);

    switch (currentConnectionType) {
      case 'bluetooth': return printViaBluetooth(data);
      case 'wifi':
      case 'rede': return printViaNetwork(data);
      case 'usb': return printViaUSB(data);
      default: return false;
    }
  } catch (error) {
    console.error("Erro ao imprimir:", error);
    return false;
  }
}

export function isPrinterConnected(): boolean {
  if (currentConnectionType === 'wifi' || currentConnectionType === 'rede') {
    return !!networkPrinterUrl;
  }
  return printerDevice?.gatt?.connected ?? printerDevice?.opened ?? false;
}

export function getConnectionType(): ConnectionType | null {
  return currentConnectionType;
}

export async function disconnectPrinter(): Promise<void> {
  if (currentConnectionType === 'bluetooth') {
    printerDevice?.gatt?.disconnect();
  } else if (currentConnectionType === 'usb') {
    await printerDevice?.close?.();
  }
  printerDevice = null;
  printerCharacteristic = null;
  networkPrinterUrl = null;
  currentConnectionType = null;
}
