


<img width="3854" height="2168" alt="SilentSign_CoverImage jpg" src="https://github.com/user-attachments/assets/74e92f12-3e59-45d5-b4f2-661baff16c08" />

---

PublishDate: 2026-08-25

Title: SilentSign - A Low-Cost Gesture-to-Voice AAC Device

Excerpt: A gesture-to-voice AAC prototype built on the MYOSA Mini toolkit, turning wrist gestures into spoken phrases via a live dashboard.
 
tags:
- AAC
- Assistive Technology
- ESP32
- MYOSA
- Embedded Systems
---

> Giving a voice back to people with speech or communication disabilities.

---

## Acknowledgements

Built by Team SilentSign — Mruthula S, Abhishek Somarajan, Sreeparvathy Preeth, and Mohamed Razin Mujeeb — B.Tech students at Adi Shankara Institute of Engineering and Technology (ASIET), Kalady, under the mentorship of Anju Mary Joseph, Dept. of RA, ASIET Kalady. Submitted as part of IEEE Sensors Council – MYOSA 6.0.

---

## Overview

An estimated 70 million people in India live with a speech or communication disability, including ALS, cerebral palsy, stroke-induced aphasia, and autism spectrum disorder. Commercial AAC (Augmentative and Alternative Communication) devices cost USD 5,000–15,000, putting them out of reach for over 97% of people who need one.

**SilentSign** is a low-cost gesture-to-voice prototype built on the MYOSA Mini toolkit. A wrist gesture is detected by the ESP32 and sensor stack, matched against a phrase vocabulary, and spoken aloud in real time through a live dashboard.

**Current prototype status:** The ESP32 + sensor stack is wired to a laptop via USB, and gestures already trigger real speech output through a working web dashboard — this loop is fully functional today. Wireless (BLE) operation and a standalone, wrist-worn app are the next iteration, not yet built.

**Key features:**
* Gesture-to-speech working end-to-end on the current wired prototype, with a live web dashboard
* Bill-of-materials cost under USD 30
* 7 gestures mapped to editable AAC phrases (up, down, left, right, roll left, roll right, shake)
* Configurable vocabulary — new gesture/phrase pairs can be added directly from the dashboard
* Live sensor readout (temperature, pressure, altitude) alongside the gesture event log

---

## Demo / Examples

### Images

Team :

<img width="4000" height="2252" alt="20260820_130542 jpg" src="https://github.com/user-attachments/assets/2d8fb592-dd2a-4ae1-ab19-f7890cac8a3c" />

------

<img width="4000" height="2252" alt="20260820_114657 jpg" src="https://github.com/user-attachments/assets/87bf658c-bf35-4e80-8425-4ecd0757e18a" />





### Videos

Live Demo (Drive) : https://drive.google.com/file/d/1_qlSOhWAQnA9Q7wqo940EExxJNtTRItW/view?

---

## Features (Detailed)

### 1. Directional Gesture Detection (APDS9960)

The APDS9960 handles directional gesture detection — up, down, left, right — using four internal infrared photodiodes. It classifies swipe direction purely from the sequence and timing of light hitting each photodiode, and hands the ESP32 a clean directional result.

`TECH: I2C address 0x39, polled via isGestureAvailable() / readGesture().`

### 2. Motion & Orientation Sensing (MPU6050)

The MPU6050 is a 3-axis accelerometer plus 3-axis gyroscope, giving additional gesture channels: roll left, roll right, and shake.

`TECH: I2C address 0x68; gyro magnitude computed via sqrt(gx² + gy² + gz²) converted to degrees/second to distinguish fast vs. slow motion; accelerometer angle used for roll/tilt detection.`

### 3. Environmental Sensing (BMP180)

The BMP180 is active in the current build, providing live temperature, pressure, and altitude readings alongside gesture events on the dashboard.

`TECH: I2C, 0–1100 hPa range.`

Together, these sensors currently support **7 gestures**, each mapped to a configurable AAC phrase via the dashboard:

| Gesture | Spoken Phrase |
|---|---|
| up | No |
| down | Yes |
| left | I need my medication |
| right | I need help using the washroom |
| roll left | I am hungry |
| roll right | I am thirsty |
| shake | Emergency! I need help |

The vocabulary is not hardcoded — new gesture/phrase pairs can be added directly from the dashboard's input fields.

### 4. Software Pipeline (Current: Wired via USB Serial)

The ESP32 runs a continuous state machine and polls all sensors over I2C. When a gesture crosses the detection threshold, it sends the gesture ID as plain text over the USB serial connection to the laptop.

The dashboard reads this serial data, looks up the matching phrase in its editable vocabulary table, speaks it aloud via text-to-speech, and logs the event with a timestamp — this full loop already works end-to-end.

**Planned / Next Steps (not yet implemented):** Replacing the USB cable with a wireless BLE link, so the wearable can communicate with a phone app instead of a tethered laptop, making the device fully wrist-worn and untethered.

---

## Usage Instructions

1. Connect the SilentSign prototype (ESP32 + sensor stack) to a laptop via USB cable.
2. Open the SilentSign dashboard.
3. Perform a gesture — up, down, left, right, roll left, roll right, or shake.
4. The matched phrase is spoken aloud and logged live on the dashboard, with the option to add new gesture/phrase pairs on the fly.

```plaintext
# Example: flashing firmware to the ESP32
arduino-cli upload -p COM3 --fqbn esp32:esp32:esp32 silentsign_firmware
```

---

## Tech Stack

* **ESP32** (MYOSA MCU) — gesture classification, serial transmission
* **APDS9960** — directional gesture sensor
* **MPU6050** — 3-axis accelerometer + gyroscope
* **BMP180** — temperature, pressure, altitude
* **USB Serial (UART)** — current wired link to laptop
* **Web dashboard** — live phrase display, editable vocabulary, event log, text-to-speech
* **Arduino / ESP-IDF** — firmware
* *Planned:* BLE for wireless, wrist-worn operation

---

## Requirements / Installation

```bash
# Arduino IDE or arduino-cli with ESP32 board support required for firmware flashing
# Dashboard connects over serial once firmware is flashed
```

---



