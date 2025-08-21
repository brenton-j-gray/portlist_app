import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Image, Modal, PanResponder, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../../components/AuthContext';
import { useTheme } from '../../components/ThemeContext';
import { apiGetProfile, apiSaveProfile } from '../../lib/api';

export default function ProfileScreen() {
  const { themeColors } = useTheme();
  const { refreshProfile, userAvatar, setUserAvatar } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [busy, setBusy] = useState(false);
  const [pickerVisible, setPickerVisible] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  const [frameSize, setFrameSize] = useState(260);
  const [imgScale, setImgScale] = useState(1);
  const [imgOffset, setImgOffset] = useState({ x: 0, y: 0 });
  const [origSize, setOrigSize] = useState<{ w: number; h: number } | null>(null);
  const pan = useRef({ x: 0, y: 0 }).current as { x: number; y: number };
  const responder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_e, g) => {
        setImgOffset({ x: pan.x + g.dx, y: pan.y + g.dy });
      },
      onPanResponderRelease: (_e, g) => {
        pan.x += g.dx; pan.y += g.dy;
      },
    })
  ).current;

  useEffect(() => {
    (async () => {
      try {
        const res = await apiGetProfile();
        const p = res.profile || ({} as any);
        const full = (p.fullName || '').trim();
        if (full) {
          const parts = full.split(/\s+/);
          const f = parts.shift() || '';
          const l = parts.join(' ');
          setFirstName(f);
          setLastName(l);
        } else {
          setFirstName('');
          setLastName('');
        }
        setUsername(p.username || '');
        setBio(p.bio || '');
      } catch {
        // ignore if not logged in or network error
      }
    })();
  }, []);

  const styles = useMemo(() => StyleSheet.create({
    container: { flex: 1, padding: 16, backgroundColor: themeColors.background },
    input: { borderWidth: 1, borderColor: themeColors.menuBorder, backgroundColor: themeColors.card, color: themeColors.text, borderRadius: 8, padding: 12, marginBottom: 10 },
    btn: { backgroundColor: themeColors.primary, padding: 12, borderRadius: 10, alignItems: 'center', marginTop: 4 },
    btnText: { color: 'white', fontWeight: '700' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 12 },
  avatar: { width: 72, height: 72, borderRadius: 36, backgroundColor: themeColors.menuBorder },
  pickBtn: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: themeColors.primary, backgroundColor: themeColors.primary + '12' },
  pickBtnText: { color: themeColors.primaryDark },
  modalWrap: { flex: 1, backgroundColor: themeColors.background },
  cropHeader: { padding: 12, borderBottomWidth: 1, borderBottomColor: themeColors.menuBorder, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    cropArea: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  circleMask: { position: 'absolute', width: frameSize, height: frameSize, borderRadius: frameSize/2, borderWidth: 2, borderColor: themeColors.primary },
  toolbar: { padding: 12, borderTopWidth: 1, borderTopColor: themeColors.menuBorder },
  }), [themeColors, frameSize]);

  async function onSave() {
    try {
      setBusy(true);
      // Build fullName from first + last; send explicit empties to clear
      const full = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
      const payload = {
        fullName: full,
        username: username.trim(),
        bio: bio.trim(),
      };
      await apiSaveProfile(payload);
      // Refresh Auth header/userName immediately
      await refreshProfile();
  // Return to Settings tab after a successful save
  router.replace('/(tabs)/settings');
    } catch (e: any) {
      Alert.alert('Save failed', e?.message || 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function pickImage() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', 'Allow photo access to set your profile picture.'); return; }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 1, allowsEditing: false });
    if (res.canceled) return;
  const asset = res.assets?.[0];
  const uri = asset?.uri;
    if (!uri) return;
    setPicked(uri);
  if (asset?.width && asset?.height) setOrigSize({ w: asset.width, h: asset.height });
    setImgScale(1);
    setImgOffset({ x: 0, y: 0 });
  pan.x = 0; pan.y = 0;
    setPickerVisible(true);
  }

  async function confirmCrop() {
    if (!picked) return;
    try {
      const canvas = Math.round(frameSize * 1.6);
      const ow = origSize?.w || 1000;
      const oh = origSize?.h || 1000;
      // Displayed dimensions preserving aspect ratio
      const dw = Math.round(canvas * imgScale);
      const dh = Math.round(dw * (oh / ow));
      const imgX0 = Math.round((canvas - dw) / 2 + imgOffset.x);
      const imgY0 = Math.round((canvas - dh) / 2 + imgOffset.y);
      const cx = Math.round(canvas / 2);
      const cy = Math.round(canvas / 2);
      const r = Math.round(frameSize / 2);
      const cropLeft = cx - r;
      const cropTop = cy - r;
      const cropSize = frameSize;
      // Intersection with image rect
      const interLeft = Math.max(cropLeft, imgX0);
      const interTop = Math.max(cropTop, imgY0);
      const interRight = Math.min(cropLeft + cropSize, imgX0 + dw);
      const interBottom = Math.min(cropTop + cropSize, imgY0 + dh);
      const interW = Math.max(0, interRight - interLeft);
      const interH = Math.max(0, interBottom - interTop);
      if (interW <= 2 || interH <= 2) throw new Error('Image is outside the crop area. Reposition and try again.');
      const scaleX = ow / dw;
      const scaleY = oh / dh;
      const originX = Math.max(0, Math.floor((interLeft - imgX0) * scaleX));
      const originY = Math.max(0, Math.floor((interTop - imgY0) * scaleY));
      const width = Math.min(ow - originX, Math.floor(interW * scaleX));
      const height = Math.min(oh - originY, Math.floor(interH * scaleY));

      const result = await ImageManipulator.manipulateAsync(
        picked,
        [{ crop: { originX, originY, width, height } }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.JPEG }
      );
      await setUserAvatar(result.uri);
      setPickerVisible(false);
    } catch (e: any) {
      Alert.alert('Crop failed', e?.message || 'Try again.');
    }
  }

  return (
    <View style={styles.container}>
  {/* Header already renders the title */}
  <View style={styles.avatarRow}>
    <Image source={userAvatar ? { uri: userAvatar } : undefined} style={styles.avatar} />
    <Pressable onPress={pickImage} style={styles.pickBtn}>
      <Text style={styles.pickBtnText}>Change photo</Text>
    </Pressable>
  </View>
  <TextInput placeholder="First name" placeholderTextColor={themeColors.textSecondary} style={styles.input} value={firstName} onChangeText={setFirstName} />
  <TextInput placeholder="Last name" placeholderTextColor={themeColors.textSecondary} style={styles.input} value={lastName} onChangeText={setLastName} />
  <TextInput autoCapitalize="none" placeholder="Public username" placeholderTextColor={themeColors.textSecondary} style={styles.input} value={username} onChangeText={setUsername} />
  <TextInput placeholder="Bio" placeholderTextColor={themeColors.textSecondary} style={[styles.input, { height: 120 }]} multiline value={bio} onChangeText={setBio} />
      <Pressable onPress={onSave} style={styles.btn} disabled={busy}>
        <Text style={styles.btnText}>{busy ? 'Saving…' : 'Save'}</Text>
      </Pressable>

      <Modal visible={pickerVisible} animationType="slide" onRequestClose={() => setPickerVisible(false)}>
        <View style={styles.modalWrap}>
          <View style={styles.cropHeader}>
            <Pressable onPress={() => setPickerVisible(false)}><Text style={{ color: themeColors.primaryDark }}>Cancel</Text></Pressable>
            <Text style={{ color: themeColors.text, fontWeight: '700' }}>Crop</Text>
            <Pressable onPress={confirmCrop}><Text style={{ color: themeColors.primaryDark, fontWeight: '700' }}>Done</Text></Pressable>
          </View>
          <View style={styles.cropArea}>
            {picked ? (
              <View style={{ width: Math.round(frameSize * 1.6), height: Math.round(frameSize * 1.6), overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }} {...responder.panHandlers}>
                {(() => {
                  const canvas = Math.round(frameSize * 1.6);
                  const ow = origSize?.w || 1000; const oh = origSize?.h || 1000;
                  const dw = Math.round(canvas * imgScale);
                  const dh = Math.round(dw * (oh / ow));
                  return (
                    <Image source={{ uri: picked }} style={{ width: dw, height: dh, transform: [{ translateX: imgOffset.x }, { translateY: imgOffset.y }] }} />
                  );
                })()}
                <View pointerEvents="none" style={styles.circleMask} />
              </View>
            ) : null}
          </View>
          <View style={[styles.toolbar, { gap: 12 }] }>
            <Text style={{ color: themeColors.textSecondary }}>Drag to position. Adjust frame and zoom:</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable onPress={() => setFrameSize((s) => Math.max(160, s - 20))} style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: themeColors.menuBorder, borderRadius: 8 }}>
                  <Text style={{ color: themeColors.text }}>− Frame</Text>
                </Pressable>
                <Pressable onPress={() => setFrameSize((s) => Math.min(340, s + 20))} style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: themeColors.menuBorder, borderRadius: 8 }}>
                  <Text style={{ color: themeColors.text }}>+ Frame</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Pressable onPress={() => setImgScale((z) => Math.max(0.5, parseFloat((z - 0.1).toFixed(2))))} style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: themeColors.menuBorder, borderRadius: 8 }}>
                  <Text style={{ color: themeColors.text }}>− Zoom</Text>
                </Pressable>
                <Pressable onPress={() => setImgScale((z) => Math.min(3, parseFloat((z + 0.1).toFixed(2))))} style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: themeColors.menuBorder, borderRadius: 8 }}>
                  <Text style={{ color: themeColors.text }}>+ Zoom</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
