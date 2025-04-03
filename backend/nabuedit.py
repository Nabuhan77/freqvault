import numpy as np
import pyaes
import sounddevice as sd
import requests
import matplotlib.pyplot as plt
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import io
import os
import wave
import logging
import base64
import threading
import time
import queue

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Set matplotlib to use a non-interactive backend to avoid threading issues
plt.switch_backend('Agg')

app = Flask(__name__)
CORS(app)

# Global variables for dynamic recording
recording_active = False
audio_queue = queue.Queue()
SAMPLE_RATE = 44100  # Audio sample rate

# ANU QRNG API URL
QRNG_API_URL = 'https://qrng.anu.edu.au/API/jsonI.php'

def fetch_quantum_key(size=32, retries=3):
    """
    Fetch a quantum-generated key from the ANU QRNG API.
    Falls back to local entropy if the API fails after retries.
    """
    logger.info(f"Attempting to fetch quantum key of size {size} bytes from ANU QRNG...")
    
    for attempt in range(retries):
        try:
            logger.info(f"Attempt {attempt + 1}/{retries} to fetch from ANU QRNG")
            response = requests.get(QRNG_API_URL, params={'length': size, 'type': 'uint8'})
            response.raise_for_status()
            data = response.json()
            
            if data['success']:
                quantum_key = bytes(data['data'])
                logger.info(f"Successfully fetched quantum key: {quantum_key.hex()[:20]}...")
                return quantum_key
            else:
                logger.warning(f"Attempt {attempt + 1} failed: {data}")
        except Exception as e:
            logger.error(f"Attempt {attempt + 1} failed with error: {e}")
    
    logger.warning("QRNG API failed, falling back to local entropy")
    local_key = os.urandom(size)
    logger.info(f"Generated local entropy key: {local_key.hex()[:20]}...")
    return local_key

# Frequency Hopping Parameters
START_FREQ = 118e6  # 118 MHz
END_FREQ = 137e6  # 137 MHz
HOPPING_RATE = 5  # Hops per second
NUM_HOPS = 15  # Number of hops
DURATION = 10  # Default recording duration in seconds (legacy)

def audio_recorder_callback(indata, frames, time, status):
    """Callback for audio recording that puts data into the queue"""
    if status:
        logger.warning(f"Audio callback status: {status}")
    if recording_active:
        audio_queue.put(indata.copy())

def recorder_thread():
    """Thread function for continuous recording"""
    global recording_active
    
    with sd.InputStream(samplerate=SAMPLE_RATE, channels=1, 
                      callback=audio_recorder_callback, dtype='float32'):
        while recording_active:
            time.sleep(0.1)

@app.route('/api/start-recording', methods=['POST'])
def start_recording():
    """Start dynamic audio recording"""
    global recording_active
    
    try:
        # Clear the audio queue if there was previous data
        while not audio_queue.empty():
            audio_queue.get()
            
        # Start recording
        recording_active = True
        logger.info("Starting dynamic audio recording...")
        print("\U0001F3A4 Recording started. Waiting for stop command...")
        
        # Start recording in a separate thread
        threading.Thread(target=recorder_thread, daemon=True).start()
        
        return jsonify({
            'success': True,
            'message': 'Recording started'
        })
    except Exception as e:
        recording_active = False
        logger.error(f"Start recording error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/stop-recording', methods=['POST'])
def stop_recording():
    """Stop dynamic audio recording and return the recorded data"""
    global recording_active
    
    try:
        if not recording_active:
            return jsonify({'success': False, 'error': 'Recording was not active'}), 400
            
        logger.info("Stopping audio recording...")
        recording_active = False
        time.sleep(0.5)  # Give time for the recorder thread to finish
        
        # Collect all audio data from queue
        audio_chunks = []
        while not audio_queue.empty():
            audio_chunks.append(audio_queue.get())
            
        if not audio_chunks:
            return jsonify({'success': False, 'error': 'No audio data recorded'}), 400
            
        # Combine audio chunks
        voice_signal = np.concatenate(audio_chunks)
        voice_signal = voice_signal.flatten()
        
        logger.info(f"Recording complete. Signal shape: {voice_signal.shape}, Max amplitude: {np.max(np.abs(voice_signal))}")
        logger.info(f"Signal dtype: {voice_signal.dtype}, First few values: {voice_signal[:5]}")
        print("\u2705 Recording stopped and data collected.")
        
        # Ensure the audio data is in a consistent format (float64)
        # The recording callback uses float32, so we need to convert
        if voice_signal.dtype != np.float64:
            logger.info(f"Converting audio from {voice_signal.dtype} to float64")
            voice_signal = voice_signal.astype(np.float64)
        
        # Normalize if needed (ensure values are in [-1, 1] range)
        max_amplitude = np.max(np.abs(voice_signal))
        if max_amplitude > 1.0:
            logger.info(f"Normalizing audio with max amplitude {max_amplitude}")
            voice_signal = voice_signal / max_amplitude
        
        # Convert audio to base64 for sending to frontend
        audio_bytes = voice_signal.tobytes()
        base64_audio = base64.b64encode(audio_bytes).decode('utf-8')
        
        logger.info(f"Sending unencrypted audio data, size: {len(audio_bytes)} bytes")
        logger.info(f"Data format: float64, {len(voice_signal)} samples")
        
        # Additional debug information
        duration = len(voice_signal) / SAMPLE_RATE
        logger.info(f"Recording duration: {duration:.2f} seconds")
        
        return jsonify({
            'success': True,
            'raw_audio_data': base64_audio,
            'sample_rate': SAMPLE_RATE,
            'channels': 1,
            'duration': duration,  # Actual duration in seconds
            'format': 'float64',
            'samples': len(voice_signal)
        })
    except Exception as e:
        recording_active = False
        logger.error(f"Stop recording error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/record-only', methods=['POST'])
def record_audio_only():
    """
    Legacy endpoint for fixed-duration recording without encryption
    """
    try:
        logger.info("Starting fixed-duration audio recording process (without encryption)...")
        print("\U0001F3A4 Recording voice for 10 seconds...")
        
        # Record audio - specify dtype explicitly as float64 for consistency
        voice_signal = sd.rec(int(SAMPLE_RATE * DURATION), samplerate=SAMPLE_RATE, channels=1, dtype=np.float64)
        sd.wait()
        voice_signal = voice_signal.flatten()
        
        logger.info(f"Recording complete. Signal shape: {voice_signal.shape}, Max amplitude: {np.max(np.abs(voice_signal))}")
        logger.info(f"Signal dtype: {voice_signal.dtype}, First few values: {voice_signal[:5]}")
        print("\u2705 Recording complete.")
        
        # Normalize if needed
        max_amplitude = np.max(np.abs(voice_signal))
        if max_amplitude > 1.0:
            logger.info(f"Normalizing audio with max amplitude {max_amplitude}")
            voice_signal = voice_signal / max_amplitude
            
        # Convert audio to base64 for sending to frontend
        audio_bytes = voice_signal.tobytes()
        base64_audio = base64.b64encode(audio_bytes).decode('utf-8')
        
        logger.info(f"Sending unencrypted audio data, size: {len(audio_bytes)} bytes")
        logger.info(f"Data format: float64, {len(voice_signal)} samples")
        
        return jsonify({
            'success': True,
            'raw_audio_data': base64_audio,
            'sample_rate': SAMPLE_RATE,
            'channels': 1,
            'duration': DURATION,
            'format': 'float64',
            'samples': len(voice_signal)
        })
    except Exception as e:
        logger.error(f"Recording error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/encrypt', methods=['POST'])
def encrypt_audio():
    """
    Encrypts previously recorded audio
    """
    try:
        data = request.json
        if not data or 'raw_audio_data' not in data:
            logger.error("Missing raw audio data in encryption request")
            return jsonify({'success': False, 'error': 'Missing raw audio data'}), 400

        logger.info("Starting encryption process for provided audio...")
        
        try:
            # Decode the base64 audio data
            audio_bytes = base64.b64decode(data['raw_audio_data'])
            logger.info(f"Received audio data size: {len(audio_bytes)} bytes")
            logger.info(f"First few bytes: {[b for b in audio_bytes[:8]]}")
        except Exception as decode_err:
            logger.error(f"Failed to decode base64 data: {str(decode_err)}")
            return jsonify({'success': False, 'error': 'Invalid audio data format'}), 400
        
        # Generate AES key and encrypt
        logger.info("Generating quantum key for encryption...")
        aes_key = fetch_quantum_key(32)
        logger.info("Creating AES cipher in CTR mode...")
        aes = pyaes.AESModeOfOperationCTR(aes_key)
        
        # Store the original data type and shape for decryption
        try:
            # Try interpreting as float64 (the common format)
            float_signal = np.frombuffer(audio_bytes, dtype=np.float64)
            if len(float_signal) > 0:
                data_type = 'float64'
                signal_shape = float_signal.shape
                logger.info(f"Audio interpreted as float64, shape: {signal_shape}, range: {np.min(float_signal)} to {np.max(float_signal)}")
            else:
                # Fallback to raw bytes
                data_type = 'bytes'
                signal_shape = (len(audio_bytes),)
                logger.info(f"Audio interpreted as raw bytes, length: {len(audio_bytes)}")
        except Exception as e:
            # Fallback to raw bytes
            data_type = 'bytes'
            signal_shape = (len(audio_bytes),)
            logger.info(f"Error interpreting audio format, using raw bytes: {str(e)}")
            
        logger.info(f"Audio data type: {data_type}, shape: {signal_shape}")
        
        logger.info("Encrypting audio data...")
        encrypted_voice = aes.encrypt(audio_bytes)
        logger.info(f"Encryption complete. Encrypted data size: {len(encrypted_voice)} bytes")
        
        # Log some statistics about the encryption
        logger.info("Encryption Statistics:")
        logger.info(f"- Original audio size: {len(audio_bytes)} bytes")
        logger.info(f"- Encrypted data size: {len(encrypted_voice)} bytes")
        logger.info(f"- AES Key (first 20 chars): {aes_key.hex()[:20]}...")
        
        # Convert to hex string
        try:
            # Use binascii instead of numpy conversion for more reliable hex encoding
            import binascii
            encrypted_hex = binascii.hexlify(encrypted_voice).decode('ascii')
            key_hex = aes_key.hex()
            
            # Add metadata to help with decryption
            metadata = {
                'data_type': data_type,
                'shape': list(signal_shape),
                'sample_rate': SAMPLE_RATE
            }
            
            # Verify that the hex encoding worked properly
            if len(encrypted_hex) != len(encrypted_voice) * 2:
                raise ValueError("Encrypted data hex conversion produced incorrect length")
                
            return jsonify({
                'success': True,
                'encrypted_data': encrypted_hex,
                'aes_key': key_hex,
                'metadata': metadata
            })
        except Exception as encode_err:
            logger.error(f"Failed to encode encrypted data: {str(encode_err)}")
            return jsonify({'success': False, 'error': 'Failed to encode encrypted data'}), 500
            
    except Exception as e:
        logger.error(f"Encryption error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/record', methods=['POST'])
def record_audio():
    """
    Legacy endpoint that does both recording and encryption
    """
    try:
        logger.info("Starting audio recording process...")
        print("\U0001F3A4 Recording voice for 10 seconds...")
        voice_signal = sd.rec(int(SAMPLE_RATE * DURATION), samplerate=SAMPLE_RATE, channels=1, dtype=np.float64)
        sd.wait()
        voice_signal = voice_signal.flatten()
        logger.info(f"Recording complete. Signal shape: {voice_signal.shape}, Max amplitude: {np.max(np.abs(voice_signal))}")
        print("\u2705 Recording complete.")
        
        # Generate AES key and encrypt
        logger.info("Generating quantum key for encryption...")
        aes_key = fetch_quantum_key(32)
        logger.info("Creating AES cipher in CTR mode...")
        aes = pyaes.AESModeOfOperationCTR(aes_key)
        
        logger.info("Converting audio signal to bytes for encryption...")
        audio_bytes = voice_signal.tobytes()
        logger.info(f"Audio data size: {len(audio_bytes)} bytes")
        
        logger.info("Encrypting audio data...")
        encrypted_voice = aes.encrypt(audio_bytes)
        logger.info(f"Encryption complete. Encrypted data size: {len(encrypted_voice)} bytes")
        
        # Log some statistics about the encryption
        logger.info("Encryption Statistics:")
        logger.info(f"- Original audio size: {len(audio_bytes)} bytes")
        logger.info(f"- Encrypted data size: {len(encrypted_voice)} bytes")
        logger.info(f"- AES Key (first 20 chars): {aes_key.hex()[:20]}...")
        
        return jsonify({
            'success': True,
            'encrypted_data': np.frombuffer(encrypted_voice, dtype=np.uint8).tobytes().hex(),
            'aes_key': aes_key.hex()
        })
    except Exception as e:
        logger.error(f"Recording error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/decrypt', methods=['POST'])
def decrypt_audio():
    try:
        data = request.json
        if not data or 'encrypted_data' not in data or 'aes_key' not in data:
            logger.error("Missing required data in decryption request")
            return jsonify({'success': False, 'error': 'Missing required data'}), 400

        logger.info("Starting decryption process...")
        
        try:
            # Convert hex to bytes
            encrypted_data = bytes.fromhex(data['encrypted_data'])
            aes_key = bytes.fromhex(data['aes_key'])
        except ValueError as hex_err:
            logger.error(f"Invalid hex data: {str(hex_err)}")
            return jsonify({'success': False, 'error': 'Invalid encrypted data format'}), 400
        
        logger.info(f"Received encrypted data size: {len(encrypted_data)} bytes")
        logger.info(f"Using AES key (first 20 chars): {aes_key.hex()[:20]}...")
        
        # Check if metadata is available
        metadata = data.get('metadata', {})
        data_type = metadata.get('data_type', 'unknown')
        shape = metadata.get('shape', [])
        sample_rate = metadata.get('sample_rate', SAMPLE_RATE)
        
        if metadata:
            logger.info(f"Received metadata: data_type={data_type}, shape={shape}, sample_rate={sample_rate}")
        else:
            logger.info("No metadata provided, will attempt to detect data type")
        
        try:
            # Decrypt the data
            logger.info("Creating AES cipher for decryption...")
            aes_decrypt = pyaes.AESModeOfOperationCTR(aes_key)
            
            logger.info("Decrypting audio data...")
            decrypted_voice = aes_decrypt.decrypt(encrypted_data)
            logger.info(f"Decryption complete. Decrypted data size: {len(decrypted_voice)} bytes")
            logger.info(f"First few bytes of decrypted data: {[b for b in decrypted_voice[:8]]}")
        except Exception as decrypt_err:
            logger.error(f"Failed to decrypt data: {str(decrypt_err)}")
            return jsonify({'success': False, 'error': 'Failed to decrypt data'}), 500
        
        try:
            # Parse according to the metadata or detect
            if data_type == 'float64' and shape:
                try:
                    logger.info(f"Using metadata: interpreting as float64 with shape {shape}")
                    expected_bytes = np.prod(shape) * 8  # 8 bytes per float64
                    
                    if len(decrypted_voice) >= expected_bytes:
                        decrypted_voice_signal = np.frombuffer(decrypted_voice[:expected_bytes], dtype=np.float64)
                        if len(shape) > 1:
                            decrypted_voice_signal = decrypted_voice_signal.reshape(shape)
                        logger.info(f"Successfully interpreted as float64, shape: {decrypted_voice_signal.shape}")
                    else:
                        logger.warning(f"Expected {expected_bytes} bytes for float64 but got {len(decrypted_voice)}")
                        raise ValueError("Insufficient data for expected shape")
                except Exception as reshape_err:
                    logger.error(f"Error reshaping data: {str(reshape_err)}")
                    # Fall back to simple interpretation
                    decrypted_voice_signal = np.frombuffer(decrypted_voice, dtype=np.float64)
                    logger.info(f"Fallback to simple float64 interpretation, shape: {decrypted_voice_signal.shape}")
            else:
                # Try to detect type
                logger.info("Attempting to detect data type automatically...")
                
                # First try as float64
                try:
                    decrypted_voice_signal = np.frombuffer(decrypted_voice, dtype=np.float64)
                    if len(decrypted_voice_signal) == 0:
                        raise ValueError("No data after float64 conversion")
                        
                    # Check if values are in reasonable range for audio
                    max_val = np.max(np.abs(decrypted_voice_signal))
                    logger.info(f"Interpreted as float64, max value: {max_val}")
                    
                    if max_val > 1e10:  # Unreasonable for audio
                        logger.warning(f"Float64 values too large ({max_val}), trying other formats")
                        raise ValueError("Values out of normal audio range")
                except Exception as float_err:
                    logger.warning(f"Failed float64 interpretation: {str(float_err)}")
                    
                    # Try as int16
                    try:
                        logger.info("Trying int16 interpretation...")
                        int16_data = np.frombuffer(decrypted_voice, dtype=np.int16)
                        if len(int16_data) == 0:
                            raise ValueError("No data after int16 conversion")
                            
                        # Convert to float64 for processing
                        logger.info(f"Converting int16 data to float64, shape: {int16_data.shape}")
                        decrypted_voice_signal = int16_data.astype(np.float64) / 32767.0
                    except Exception as int16_err:
                        logger.error(f"Failed int16 interpretation: {str(int16_err)}")
                        
                        # Last resort - treat as raw PCM
                        logger.warning("Treating as raw byte data...")
                        pcm_data = np.frombuffer(decrypted_voice, dtype=np.uint8)
                        pcm_data = pcm_data.astype(np.float64) / 128.0 - 1.0
                        decrypted_voice_signal = pcm_data
                        logger.info(f"Created float64 array from raw bytes, shape: {decrypted_voice_signal.shape}")
            
            # Now we should have a float64 signal, normalize it properly
            logger.info(f"Processing signal, shape: {decrypted_voice_signal.shape}, min: {np.min(decrypted_voice_signal)}, max: {np.max(decrypted_voice_signal)}")
            
            # Normalize if not already in [-1,1] range
            if np.max(np.abs(decrypted_voice_signal)) > 1.0:
                max_val = np.max(np.abs(decrypted_voice_signal))
                decrypted_voice_signal = decrypted_voice_signal / max_val
                logger.info(f"Normalized signal, new range: {np.min(decrypted_voice_signal)} to {np.max(decrypted_voice_signal)}")
            
            # Safety clip to [-1,1]
            decrypted_voice_signal = np.clip(decrypted_voice_signal, -1.0, 1.0)
            
            # Convert to 16-bit PCM
            logger.info("Converting to 16-bit PCM format...")
            audio_16bit = np.int16(decrypted_voice_signal * 32767)
            
            # Create WAV file
            logger.info(f"Creating WAV file with sample rate {sample_rate}Hz...")
            buffer = io.BytesIO()
            
            try:
                # The 'wb' mode creates a Wave_write object, not Wave_read
                wav_file = wave.open(buffer, 'wb')
                wav_file.setnchannels(1)  # Mono
                wav_file.setsampwidth(2)  # 16-bit
                wav_file.setframerate(sample_rate)
                wav_bytes = audio_16bit.tobytes()
                wav_file.writeframes(wav_bytes)
                wav_file.close()  # Explicitly close to ensure all data is written
                
                logger.info(f"Wrote {len(wav_bytes)} bytes to WAV file")
                
                buffer.seek(0)
                file_size = buffer.getbuffer().nbytes
                logger.info(f"WAV file created, size: {file_size} bytes")
                
                if file_size == 0:
                    raise ValueError("Created an empty WAV file")
                
                # Add more detailed logging about the created file
                logger.info(f"WAV file details: sample rate {sample_rate}Hz, 16-bit, mono, {len(audio_16bit)} samples")
                logger.info(f"Duration: {len(audio_16bit)/sample_rate:.2f} seconds")
                
                # Set content disposition header to indicate this is an attachment
                return send_file(
                    buffer,
                    mimetype='audio/wav',
                    as_attachment=False,  # Changed to False to play in browser
                    download_name='decrypted_audio.wav'
                )
            except Exception as wav_write_err:
                logger.error(f"WAV write error: {str(wav_write_err)}")
                raise
            
        except Exception as wav_err:
            logger.error(f"Failed to create WAV file: {str(wav_err)}")
            return jsonify({'success': False, 'error': f'Failed to create audio file: {str(wav_err)}'}), 500
            
    except Exception as e:
        logger.error(f"Decryption error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/visualize', methods=['GET'])
def visualize_hopping():
    try:
        logger.info("Generating frequency hopping pattern...")
        # Generate hopping pattern
        np.random.seed(int.from_bytes(fetch_quantum_key(4), 'big'))
        hop_frequencies = np.random.uniform(START_FREQ, END_FREQ, NUM_HOPS)
        time_stamps = np.arange(NUM_HOPS) / HOPPING_RATE
        
        logger.info(f"Generated {NUM_HOPS} frequencies between {START_FREQ/1e6:.2f} MHz and {END_FREQ/1e6:.2f} MHz")
        
        # Create visualization
        plt.figure(figsize=(8, 5))
        plt.plot(time_stamps, hop_frequencies / 1e6, marker='o', linestyle='-', color='r', markersize=8, label='Hopping Pattern')
        plt.xlabel("Time (seconds)")
        plt.ylabel("Frequency (MHz)")
        plt.title("Frequency Hopping Visualization")
        plt.grid(True, linestyle='--', alpha=0.6)
        plt.legend()
        
        # Save plot to buffer
        buffer = io.BytesIO()
        plt.savefig(buffer, format='png')
        buffer.seek(0)
        plt.close()
        
        logger.info("Visualization complete")
        return send_file(
            buffer,
            mimetype='image/png',
            as_attachment=True,
            download_name='hopping_pattern.png'
        )
    except Exception as e:
        logger.error(f"Visualization error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/test-audio', methods=['GET'])
def test_audio():
    """
    Generate a simple test tone WAV file for playback testing
    """
    try:
        logger.info("Generating test audio file...")
        
        # Create a simple sine wave test tone
        sample_rate = 44100
        duration = 2.0  # 2 seconds
        frequency = 440.0  # A4 note
        
        # Generate the sine wave
        t = np.linspace(0, duration, int(sample_rate * duration), False)
        tone = np.sin(2 * np.pi * frequency * t)
        
        # Normalize and convert to 16-bit PCM
        tone = np.int16(tone * 32767)
        
        # Create WAV file
        buffer = io.BytesIO()
        wav_file = wave.open(buffer, 'wb')
        wav_file.setnchannels(1)  # Mono
        wav_file.setsampwidth(2)  # 16-bit
        wav_file.setframerate(sample_rate)
        wav_file.writeframes(tone.tobytes())
        wav_file.close()
        
        # Rewind the buffer
        buffer.seek(0)
        
        logger.info("Test audio generated successfully")
        return send_file(
            buffer,
            mimetype='audio/wav',
            as_attachment=False,
            download_name='test_tone.wav'
        )
    except Exception as e:
        logger.error(f"Test audio generation error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/convert-to-wav', methods=['POST'])
def convert_to_wav():
    """
    Converts raw audio data to a playable WAV file
    """
    try:
        data = request.json
        if not data or 'raw_audio_data' not in data:
            logger.error("Missing raw audio data in conversion request")
            return jsonify({'success': False, 'error': 'Missing raw audio data'}), 400
            
        logger.info("Starting conversion of raw audio to WAV...")
        
        try:
            # Decode the base64 audio data
            audio_bytes = base64.b64decode(data['raw_audio_data'])
            logger.info(f"Received audio data size: {len(audio_bytes)} bytes")
            logger.info(f"First few bytes: {[b for b in audio_bytes[:8]]}")
        except Exception as decode_err:
            logger.error(f"Failed to decode base64 data: {str(decode_err)}")
            return jsonify({'success': False, 'error': 'Invalid audio data format'}), 400
            
        try:
            # Try to interpret as float64 first (most common format for our recording)
            audio_signal = np.frombuffer(audio_bytes, dtype=np.float64)
            if len(audio_signal) == 0:
                raise ValueError("No data after float64 conversion")
                
            logger.info(f"Interpreted as float64, shape: {audio_signal.shape}, range: {np.min(audio_signal)} to {np.max(audio_signal)}")
            
            # Normalize if needed
            if np.max(np.abs(audio_signal)) > 1.0:
                max_val = np.max(np.abs(audio_signal))
                audio_signal = audio_signal / max_val
                logger.info(f"Normalized signal, new range: {np.min(audio_signal)} to {np.max(audio_signal)}")
                
            # Safety clip to [-1,1]
            audio_signal = np.clip(audio_signal, -1.0, 1.0)
            
            # Convert to 16-bit PCM
            logger.info("Converting to 16-bit PCM format...")
            audio_16bit = np.int16(audio_signal * 32767)
        except Exception as interpret_err:
            logger.warning(f"Failed to interpret as float64: {str(interpret_err)}")
            
            # Try other common formats, starting with float32
            try:
                audio_signal = np.frombuffer(audio_bytes, dtype=np.float32)
                if len(audio_signal) == 0:
                    raise ValueError("No data after float32 conversion")
                    
                logger.info(f"Interpreted as float32, shape: {audio_signal.shape}")
                
                # Normalize and convert
                audio_signal = np.clip(audio_signal, -1.0, 1.0)
                audio_16bit = np.int16(audio_signal * 32767)
            except Exception as float32_err:
                logger.warning(f"Failed to interpret as float32: {str(float32_err)}")
                
                # Try as int16
                try:
                    audio_16bit = np.frombuffer(audio_bytes, dtype=np.int16)
                    if len(audio_16bit) == 0:
                        raise ValueError("No data after int16 conversion")
                        
                    logger.info(f"Interpreted directly as int16, shape: {audio_16bit.shape}")
                except Exception as int16_err:
                    logger.error(f"Failed to interpret audio data: {str(int16_err)}")
                    return jsonify({'success': False, 'error': 'Could not interpret audio format'}), 400
        
        # Create WAV file
        logger.info(f"Creating WAV file with sample rate {SAMPLE_RATE}Hz...")
        buffer = io.BytesIO()
        
        try:
            # Create WAV file with proper headers
            wav_file = wave.open(buffer, 'wb')
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(SAMPLE_RATE)
            wav_bytes = audio_16bit.tobytes()
            wav_file.writeframes(wav_bytes)
            wav_file.close()  # Explicitly close to ensure all data is written
            
            logger.info(f"Wrote {len(wav_bytes)} bytes to WAV file")
            
            buffer.seek(0)
            file_size = buffer.getbuffer().nbytes
            logger.info(f"WAV file created, size: {file_size} bytes")
            
            if file_size == 0:
                raise ValueError("Created an empty WAV file")
                
            # Return the WAV file
            return send_file(
                buffer,
                mimetype='audio/wav',
                as_attachment=False,
                download_name='original_recording.wav'
            )
        except Exception as wav_err:
            logger.error(f"Failed to create WAV file: {str(wav_err)}")
            return jsonify({'success': False, 'error': f'Failed to create audio file: {str(wav_err)}'}), 500
            
    except Exception as e:
        logger.error(f"Conversion error: {str(e)}")
        return jsonify({'success': False, 'error': str(e)}), 500

if __name__ == '__main__':
    logger.info("Starting Flask server...")
    app.run(debug=True, port=5000)