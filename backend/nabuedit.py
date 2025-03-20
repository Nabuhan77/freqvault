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

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

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
SAMPLE_RATE = 44100  # Audio sample rate
DURATION = 10  # Recording duration in seconds

@app.route('/api/record', methods=['POST'])
def record_audio():
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
        encrypted_data = bytes.fromhex(data['encrypted_data'])
        aes_key = bytes.fromhex(data['aes_key'])
        
        logger.info(f"Received encrypted data size: {len(encrypted_data)} bytes")
        logger.info(f"Using AES key (first 20 chars): {aes_key.hex()[:20]}...")
        
        # Decrypt the data
        logger.info("Creating AES cipher for decryption...")
        aes_decrypt = pyaes.AESModeOfOperationCTR(aes_key)
        
        logger.info("Decrypting audio data...")
        decrypted_voice = aes_decrypt.decrypt(encrypted_data)
        logger.info(f"Decryption complete. Decrypted data size: {len(decrypted_voice)} bytes")
        
        # Convert back to numpy array
        logger.info("Converting decrypted data to numpy array...")
        decrypted_voice_signal = np.frombuffer(decrypted_voice, dtype=np.float64)
        logger.info(f"Decrypted signal shape: {decrypted_voice_signal.shape}")
        
        # Normalize the audio data
        logger.info("Normalizing audio data...")
        decrypted_voice_signal = np.clip(decrypted_voice_signal, -1.0, 1.0)
        
        # Convert to 16-bit PCM
        logger.info("Converting to 16-bit PCM format...")
        audio_16bit = np.int16(decrypted_voice_signal * 32767)
        
        # Create WAV file in memory
        logger.info("Creating WAV file...")
        buffer = io.BytesIO()
        with wave.open(buffer, 'wb') as wav_file:
            wav_file.setnchannels(1)  # Mono
            wav_file.setsampwidth(2)  # 16-bit
            wav_file.setframerate(SAMPLE_RATE)
            wav_file.writeframes(audio_16bit.tobytes())
        
        buffer.seek(0)
        logger.info("Decryption process complete")
        return send_file(
            buffer,
            mimetype='audio/wav',
            as_attachment=True,
            download_name='decrypted_audio.wav'
        )
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

if __name__ == '__main__':
    logger.info("Starting Flask server...")
    app.run(debug=True, port=5000)