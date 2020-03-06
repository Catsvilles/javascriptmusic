let samplebufferpos = 0;
let heapoffset;
let samplebufferview;
let samplebuffersize;

const SAMPLE_FRAMES = 128;
let xmp = null;

async function initPlayer (wasm, modbytes, samplerate) {
    const NOT_IMPLEMENTED = () => {
        console.error('not implemented');
    };
    
    xmp = await WebAssembly.instantiate(
            wasm
        , {
        "wasi_snapshot_preview1": {
            "fd_close": NOT_IMPLEMENTED,
            "fd_write": NOT_IMPLEMENTED,
            "fd_seek": NOT_IMPLEMENTED,
            "fd_read": NOT_IMPLEMENTED,
            "environ_get": NOT_IMPLEMENTED,
            "environ_sizes_get": NOT_IMPLEMENTED,
            "args_sizes_get": NOT_IMPLEMENTED,
            "args_get": NOT_IMPLEMENTED,
            "proc_exit": NOT_IMPLEMENTED,
        },
        "env": {
            "round": (num) => Math.round(num),
            "__syscall221": NOT_IMPLEMENTED,
            "__syscall5": NOT_IMPLEMENTED,
            "__syscall10": NOT_IMPLEMENTED,
            "__syscall220": NOT_IMPLEMENTED,
            "__syscall60": NOT_IMPLEMENTED,
            "__syscall195": NOT_IMPLEMENTED,
            "__syscall54": NOT_IMPLEMENTED,
            "localtime_r": NOT_IMPLEMENTED,
            "__clock_gettime": NOT_IMPLEMENTED
        }
    });
    
    const memaddr = xmp.instance.exports.allocMemoryForModule(modbytes.byteLength);
    const heap8 = new Uint8Array(xmp.instance.exports.memory.buffer);
    
    heap8.set(modbytes, memaddr);

    xmp.instance.exports.loadModule(memaddr, modbytes.byteLength, samplerate);    
}

class MyWorkletProcessor extends AudioWorkletProcessor {

  constructor() {
    super();
    this.port.onmessage = async (msg) => {
        if(msg.data.wasm) {
            initPlayer(msg.data.wasm, msg.data.song.modbytes, msg.data.samplerate);
        }
    };
    this.port.start();
  }  

  process(inputs, outputs, parameters) {
    const output = outputs[0];
    
    if(xmp) {
        for (var n=0; n < SAMPLE_FRAMES; n++) {
            if(samplebufferpos === 0) {
                const frameinfo = xmp.instance.exports.playFrame();
                samplebufferview = new DataView(xmp.instance.exports.memory.buffer);
                const heap32 = new Uint32Array(xmp.instance.exports.memory.buffer);
        
                heapoffset = heap32[(frameinfo/4) + 10];
                samplebuffersize = heap32[(frameinfo/4) + 11];
            }
            
            output[0][n] = samplebufferview.getInt16(heapoffset + (samplebufferpos), true) / 32768.0;
            output[1][n] = samplebufferview.getInt16(heapoffset + (samplebufferpos + 2), true)  / 32768.0 ;
            samplebufferpos += 4;

            if (samplebufferpos === samplebuffersize) {
                samplebufferpos = 0;
            }
        }
    }
  
    return true;
  }
}

registerProcessor('my-worklet-processor', MyWorkletProcessor);
