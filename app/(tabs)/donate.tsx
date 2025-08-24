import { useStripe } from '@stripe/stripe-react-native';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../components/ThemeContext';
import { useToast } from '../../components/ToastContext';

// NOTE: This screen assumes a backend endpoint that creates a PaymentIntent
// POST https://<your-backend>/create-payment-intent { amountCents, currency }
// returns { clientSecret }
// For now we simulate with a mock fetch if no endpoint provided.

const BACKEND_URL = process.env.EXPO_PUBLIC_STRIPE_BACKEND || '';

export default function DonateScreen() {
  const { themeColors } = useTheme();
  const { show, showProgress, update } = useToast();
  const stripe = useStripe();
  const [amount, setAmount] = useState('5');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');

  const startDonation = useCallback(async () => {
    const numeric = parseFloat(amount);
    if (isNaN(numeric) || numeric <= 0) { show('Enter a valid amount', { kind: 'error' }); return; }
    setLoading(true);
    const progressId = 'donate';
    showProgress(progressId, 'Starting secure checkout…');
    try {
      const amountCents = Math.round(numeric * 100);
      let clientSecret: string | undefined;
      if (BACKEND_URL) {
        const resp = await fetch(`${BACKEND_URL}/create-payment-intent`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ amountCents, currency: 'usd', email }) });
        if (!resp.ok) throw new Error('Backend error');
        const data = await resp.json();
        clientSecret = data.clientSecret;
      } else {
        // mock for demo
        await new Promise(r => setTimeout(r, 800));
        clientSecret = 'pi_mock_secret';
      }
      if (!clientSecret) throw new Error('Missing client secret');
      // Present payment sheet (requires ephemeral key flow; simplified placeholder)
      const init = await stripe.initPaymentSheet({ paymentIntentClientSecret: clientSecret, merchantDisplayName: 'Cruise Journal Pro' });
      if (init.error) throw new Error(init.error.message);
      const present = await stripe.presentPaymentSheet();
      if (present.error) throw new Error(present.error.message);
      update(progressId, 'Thank you for your support!', 'success', 4000);
      setAmount('5');
    } catch (e:any) {
      update(progressId, e?.message ? String(e.message) : 'Donation failed', 'error', 5000);
    } finally {
      setLoading(false);
    }
  }, [amount, email, stripe, show, showProgress, update]);

  return (
    <View style={[styles.container,{ backgroundColor: themeColors.background }]}> 
      <Text style={[styles.title,{ color: themeColors.text }]}>Support Development</Text>
      <Text style={[styles.blurb,{ color: themeColors.textSecondary }]}>Your donation helps fund ongoing improvements (offline features, richer maps, PDF enhancements). Secure payments powered by Stripe.</Text>
      <View style={styles.fieldRow}>
        <Text style={[styles.label,{ color: themeColors.text }]}>Email (receipt)</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={themeColors.textSecondary} keyboardType="email-address" autoCapitalize='none' style={[styles.input,{ color: themeColors.text, borderColor: themeColors.menuBorder }]} />
      </View>
      <View style={styles.fieldRow}>
        <Text style={[styles.label,{ color: themeColors.text }]}>Amount (USD)</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType='decimal-pad' style={[styles.input,{ color: themeColors.text, borderColor: themeColors.menuBorder }]} />
      </View>
      <Pressable disabled={loading} onPress={startDonation} style={({pressed})=>[styles.donateBtn,{ backgroundColor: loading? themeColors.menuBorder : themeColors.primary, opacity: pressed?0.9:1 }]}>
        {loading ? <ActivityIndicator color={themeColors.badgeText} /> : <Text style={[styles.donateText,{ color: themeColors.badgeText }]}>Donate {amount ? `$${amount}`: ''}</Text>}
      </Pressable>
      <View style={{marginTop:28}}>
        <Text style={{fontSize:12,color:themeColors.textSecondary,lineHeight:16}}>Test mode: use Stripe test cards like 4242 4242 4242 4242 with any future expiry and CVC. A real backend endpoint will be required for live transactions and to create ephemeral keys.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding:20 },
  title: { fontSize:24, fontWeight:'700', marginBottom:10 },
  blurb: { fontSize:14, lineHeight:20, marginBottom:22 },
  fieldRow: { marginBottom:16 },
  label: { fontSize:13, fontWeight:'600', marginBottom:6 },
  input: { borderWidth:1, borderRadius:10, paddingHorizontal:12, paddingVertical:10, fontSize:16 },
  donateBtn: { marginTop:4, paddingVertical:14, borderRadius:14, alignItems:'center' },
  donateText: { fontSize:16, fontWeight:'700' },
});
