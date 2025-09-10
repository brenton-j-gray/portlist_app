import { useStripe } from '@stripe/stripe-react-native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useTheme } from '../../components/ThemeContext';
import { useToast } from '../../components/ToastContext';

// NOTE: This screen assumes a backend endpoint that creates a PaymentIntent
// POST https://<your-backend>/create-payment-intent { amountCents, currency }
// returns { clientSecret }
// For now we simulate with a mock fetch if no endpoint provided.

const BACKEND_URL = process.env.EXPO_PUBLIC_STRIPE_BACKEND || '';

type PaymentSheetParams = {
  paymentIntentClientSecret: string;
  customerId?: string;
  customerEphemeralKeySecret?: string;
};

const CURRENCIES = ['usd','eur'] as const;
type Currency = typeof CURRENCIES[number];

/**
 * React component validateEmail: TODO describe purpose and where it’s used.
 * @param {any} email - TODO: describe
 * @returns {any} TODO: describe
 */
function validateEmail(email: string) {
  if (!email) return true; // optional
  return /.+@.+\..+/.test(email);
}

/**
 * React component DonateScreen: TODO describe purpose and where it’s used.
 * @returns {any} TODO: describe
 */
export default function DonateScreen() {
  const { themeColors } = useTheme();
  const { show, showProgress, update } = useToast();
  const stripe = useStripe();
  const [amount, setAmount] = useState('5');
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [currency, setCurrency] = useState<Currency>('usd');

  const emailValid = useMemo(()=>validateEmail(email), [email]);
  const numericAmount = useMemo(()=>{
    const n = parseFloat(amount);
    return isNaN(n)?0:n;
  },[amount]);

  const applePaySupported = useMemo(()=> Platform.OS === 'ios', []);

  const startApplePay = useCallback(async ()=>{
    if (!applePaySupported) return;
    try {
      const amountInt = Math.round(numericAmount*100);
      if (amountInt <= 0) return show('Enter a valid amount', { kind:'error' });
  const label = 'Portlist';
      if ((stripe as any)?.presentApplePay) {
        const res = await (stripe as any).presentApplePay({ cartItems:[{ label, amount }], country: 'US', currency: currency.toUpperCase() });
        if (res.error) throw new Error(res.error.message);
        show('Apple Pay (test) success', { kind:'success', duration: 4000 });
      } else {
        show('Apple Pay not supported in this build', { kind:'error', duration: 4000 });
      }
      setAmount('5');
    } catch(e:any) {
      show(e?.message || 'Apple Pay failed', { kind:'error' });
    }
  },[applePaySupported, numericAmount, amount, currency, show, stripe]);

  const startDonation = useCallback(async () => {
    if (numericAmount <= 0) { show('Enter a valid amount', { kind: 'error' }); return; }
    if (!emailValid) { show('Enter a valid email', { kind:'error' }); return; }
    setLoading(true);
    const progressId = 'donate';
    showProgress(progressId, 'Preparing secure checkout…');
    try {
      const amountCents = Math.round(numericAmount * 100);
      let params: PaymentSheetParams | undefined;
      if (BACKEND_URL) {
        const resp = await fetch(`${BACKEND_URL}/donations/create-payment-sheet`, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify({ amountCents, currency, email }) });
        if (!resp.ok) throw new Error('Backend error');
        params = await resp.json();
      } else {
        // mock (no customer ephemeral key) – PaymentSheet may still initialize for simple PI
        await new Promise(r=>setTimeout(r,600));
        params = { paymentIntentClientSecret: 'pi_test_mock_secret' };
      }
      if (!params?.paymentIntentClientSecret) throw new Error('Missing client secret');
      const init = await stripe.initPaymentSheet({
        paymentIntentClientSecret: params.paymentIntentClientSecret,
        customerId: params.customerId,
        customerEphemeralKeySecret: params.customerEphemeralKeySecret,
  merchantDisplayName: 'Portlist',
        defaultBillingDetails: email ? { email } : undefined,
      });
      if (init.error) throw new Error(init.error.message);
      const present = await stripe.presentPaymentSheet();
      if (present.error) throw new Error(present.error.message);
      update(progressId, 'Thank you for your support!', 'success', 4500);
      setAmount('5');
    } catch (e:any) {
      update(progressId, e?.message ? String(e.message) : 'Donation failed', 'error', 5500);
    } finally {
      setLoading(false);
    }
  }, [numericAmount, emailValid, currency, email, stripe, show, showProgress, update]);

  return (
    <View style={[styles.container,{ backgroundColor: themeColors.background }]}> 
      <Text style={[styles.title,{ color: themeColors.text }]}>Support Development</Text>
      <Text style={[styles.blurb,{ color: themeColors.textSecondary }]}>Your donation helps fund ongoing improvements (offline features, richer maps, PDF enhancements). Secure payments powered by Stripe.</Text>
      <View style={styles.fieldRow}>
        <Text style={[styles.label,{ color: themeColors.text }]}>Email (receipt)</Text>
        <TextInput value={email} onChangeText={setEmail} placeholder="you@example.com" placeholderTextColor={themeColors.textSecondary} keyboardType="email-address" autoCapitalize='none' style={[styles.input,{ color: themeColors.text, borderColor: themeColors.menuBorder }]} />
        {!emailValid && <Text style={{color: themeColors.danger, fontSize: 12, marginTop:4}}>Invalid email</Text>}
      </View>
      <View style={styles.fieldRow}>
        <Text style={[styles.label,{ color: themeColors.text }]}>Amount ({currency.toUpperCase()})</Text>
        <TextInput value={amount} onChangeText={setAmount} keyboardType='decimal-pad' style={[styles.input,{ color: themeColors.text, borderColor: themeColors.menuBorder }]} />
      </View>
      <View style={{ flexDirection:'row', gap:8, marginBottom:4 }}>
        {CURRENCIES.map(c => (
          <Pressable key={c} onPress={()=>setCurrency(c)} style={({pressed})=>[{ paddingVertical:6, paddingHorizontal:14, borderRadius:20, borderWidth:1, borderColor: c===currency? themeColors.primary : themeColors.menuBorder, backgroundColor: c===currency? themeColors.primary : 'transparent', opacity: pressed?0.85:1 }]}> 
            <Text style={{ color: c===currency? themeColors.btnText : themeColors.text, fontWeight:'600', fontSize:13 }}>{c.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>
      <Pressable disabled={loading} onPress={startDonation} style={({pressed})=>[styles.donateBtn,{ backgroundColor: loading? themeColors.menuBorder : themeColors.primary, opacity: pressed?0.9:1 }]}>
        {loading ? <ActivityIndicator color={themeColors.badgeText} /> : <Text style={[styles.donateText,{ color: themeColors.badgeText }]}>Donate {amount ? `${currency === 'usd' ? '$' : '€'}${amount}`: ''}</Text>}
      </Pressable>
      {applePaySupported && (
        <Pressable disabled={loading} onPress={startApplePay} style={({pressed})=>[styles.applePayBtn,{ backgroundColor: themeColors.text, opacity: pressed?0.9:1 }] }>
          <Text style={[styles.donateText,{ color: themeColors.background }]}> Pay</Text>
        </Pressable>
      )}
      <View style={{marginTop:28}}>
        <Text style={{fontSize:12,color:themeColors.textSecondary,lineHeight:16}}>Test mode: use Stripe test cards (e.g. 4242 4242 4242 4242) with any future expiry & CVC. Backend endpoint /donations/create-payment-sheet must return paymentIntentClientSecret and (optionally) customerId + customerEphemeralKeySecret for returning donors.</Text>
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
  applePayBtn: { marginTop:12, paddingVertical:14, borderRadius:14, alignItems:'center' },
  donateText: { fontSize:16, fontWeight:'700' },
});
