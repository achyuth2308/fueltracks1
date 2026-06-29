import React, { useState, useEffect } from 'react';
import { X, CreditCard, ShieldCheck, Loader2, CheckCircle } from 'lucide-react';
import * as billingApi from '../../api/billingApi';

const DummyRazorpayModal = ({ isOpen, onClose, vehicle, onSuccess }) => {
  const [plans, setPlans] = useState([]);
  const [selectedPlanId, setSelectedPlanId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [paying, setPaying] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (isOpen && vehicle) {
      setLoading(true);
      billingApi.getVehiclePrice(vehicle.id)
        .then(res => {
          if (res.success && res.data) {
            setPlans([res.data]);
            setSelectedPlanId(res.data.id);
          } else {
            setPlans([]);
            setSelectedPlanId(null);
          }
        })
        .catch(() => {
          setPlans([]);
          setSelectedPlanId(null);
        })
        .finally(() => setLoading(false));
    } else {
      // Reset state on close
      setSuccess(false);
      setPaying(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handlePay = async () => {
    if (!selectedPlanId) return alert('Please select a plan.');
    
    setPaying(true);
    // Simulate Razorpay window delay
    setTimeout(async () => {
      try {
        const fakePaymentId = 'pay_' + Math.random().toString(36).substring(2, 15);
        const res = await billingApi.verifyRenewal({
          vehicleId: vehicle.id,
          paymentId: fakePaymentId,
          planId: selectedPlanId
        });
        
        if (res.success) {
          setSuccess(true);
          setTimeout(() => {
            setSuccess(false);
            setPaying(false);
            if (onSuccess) onSuccess();
          }, 2000);
        }
      } catch (err) {
        alert(err.response?.data?.error || 'Payment failed simulation!');
        setPaying(false);
      }
    }, 1500);
  };

  const selectedPlan = plans.find(p => p.id === selectedPlanId);

  return (
    <div className="modal-overlay" style={{ background: 'rgba(0,0,0,0.6)', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}>
      <div className="modal-box" style={{ width: '420px', background: '#FFFFFF', borderRadius: '12px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', overflow: 'hidden' }}>
        
        {success ? (
          <div style={{ padding: '48px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#D1FAE5', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '24px' }}>
              <CheckCircle size={32} color="#059669" />
            </div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#111827' }}>Payment Successful!</h2>
            <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#6B7280' }}>Your license for {vehicle?.name} has been extended by {selectedPlan?.duration_months} months.</p>
          </div>
        ) : (
          <>
            {/* Header - Looks like Razorpay */}
            <div style={{ background: '#0F172A', padding: '20px', position: 'relative' }}>
              <button onClick={onClose} disabled={paying} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#94A3B8', cursor: paying ? 'not-allowed' : 'pointer' }}>
                <X size={20} />
              </button>
              
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                <div style={{ width: '40px', height: '40px', background: '#f97316', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <ShieldCheck size={24} color="#fff" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#F8FAFC' }}>FuelTracks Secure Checkout</h3>
                  <div style={{ fontSize: '12px', color: '#94A3B8' }}>License Renewal</div>
                </div>
              </div>

              <div style={{ fontSize: '13px', color: '#94A3B8', marginBottom: '4px' }}>Vehicle: <span style={{ color: '#F8FAFC', fontWeight: 600 }}>{vehicle?.name}</span></div>
            </div>

            {/* Body */}
            <div style={{ padding: '24px' }}>
              
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', color: '#111827', fontWeight: 700 }}>Applicable Renewal Plan</h4>
              
              {loading ? (
                <div style={{ padding: '20px', textAlign: 'center' }}><Loader2 size={20} className="animate-spin" color="#f97316" style={{margin:'0 auto'}} /></div>
              ) : !selectedPlan ? (
                <div style={{ padding: '20px', textAlign: 'center', color: '#DC2626', fontSize: '14px', background: '#FEF2F2', borderRadius: '8px' }}>
                  No renewal plan configured for this vehicle. Please contact support.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
                  <div style={{
                    padding: '16px',
                    border: '1px solid #E2E8F0',
                    borderRadius: '8px',
                    background: '#F8FAFC',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>{selectedPlan.name}</div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>Extends license by {selectedPlan.duration_months} Months</div>
                    </div>
                    <div style={{ fontSize: '18px', fontWeight: 800, color: '#0F172A' }}>
                      ₹{parseFloat(selectedPlan.price).toFixed(2)}
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px dashed #E2E8F0' }}>
                <span style={{ fontSize: '14px', color: '#475569', fontWeight: 600 }}>Amount to Pay</span>
                <span style={{ fontSize: '24px', color: '#111827', fontWeight: 800 }}>
                  ₹{selectedPlan ? parseFloat(selectedPlan.price).toFixed(2) : '0.00'}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <button 
                  onClick={handlePay}
                  disabled={loading || paying || !selectedPlanId}
                  style={{ 
                    width: '100%', padding: '14px', background: '#2563EB', color: '#fff', 
                    border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 700, 
                    cursor: (loading || paying || !selectedPlanId) ? 'not-allowed' : 'pointer',
                    display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px',
                    opacity: (loading || paying || !selectedPlanId) ? 0.7 : 1
                  }}
                >
                  {paying ? <Loader2 size={18} className="animate-spin" /> : <CreditCard size={18} />}
                  {paying ? 'Processing...' : `Pay ₹${selectedPlan ? parseFloat(selectedPlan.price).toFixed(2) : '0.00'}`}
                </button>
                <div style={{ fontSize: '11px', textAlign: 'center', color: '#94A3B8', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '4px' }}>
                  <ShieldCheck size={12} /> 100% Secure Payment (Dummy)
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default DummyRazorpayModal;
