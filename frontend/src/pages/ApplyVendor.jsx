import { useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { saveLead } from '../lib/supabase';
import { showToast } from '../utils/toast';

export default function ApplyVendor() {
  const [params] = useSearchParams();
  const orgId = params.get('org');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const companyName = fd.get('companyName').trim();
    const contactPerson = fd.get('contactPerson').trim();
    if (!companyName || !contactPerson) {
      showToast('Company name and contact person are required.', 'error');
      return;
    }
    const businessDetails = fd.get('businessDetails').trim();
    const documentation = fd.get('documentation').trim();
    const credentials = fd.get('credentials').trim();
    const notes = [
      businessDetails && `Business details: ${businessDetails}`,
      documentation && `Documentation: ${documentation}`,
      credentials && `Credentials/References: ${credentials}`
    ].filter(Boolean).join('\n');

    try {
      await saveLead({
        vendor_name: companyName,
        contact_person: contactPerson,
        contact_email: fd.get('contactEmail').trim(),
        contact_phone: fd.get('contactPhone').trim(),
        stage: 'Prospecting',
        priority: 'Medium',
        status: 'Open',
        notes: notes || null,
        organization_id: orgId,
        source: 'public_onboarding'
      });
      setSubmitted(true);
      e.target.reset();
      showToast('Application submitted. Thank you!', 'success');
    } catch (err) {
      showToast(`Failed to submit application: ${err.message}`, 'error');
    }
  };

  if (!orgId) {
    return (
      <div className="apply-page">
        <div className="apply-card">
          <h1>Vendor Onboarding</h1>
          <p className="auth-message">
            This link is missing an organization reference. Please contact the company and ask them
            for their vendor onboarding link.
          </p>
          <Link to="/" className="apply-home-link">Back to home</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="apply-page">
      <div className="apply-card">
        <h1>Become a Vendor</h1>
        <p className="auth-message">
          Submit your details below. Your application is reviewed by the company's team and you will
          be contacted once it is approved.
        </p>
        <form className="vendor-review-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="companyName">Company Name *</label>
            <input id="companyName" name="companyName" type="text" placeholder="Enter company name" />
          </div>
          <div className="form-group">
            <label htmlFor="contactPerson">Contact Person *</label>
            <input id="contactPerson" name="contactPerson" type="text" placeholder="Enter contact person" />
          </div>
          <div className="form-group">
            <label htmlFor="contactEmail">Contact Email</label>
            <input id="contactEmail" name="contactEmail" type="email" placeholder="name@company.com" />
          </div>
          <div className="form-group">
            <label htmlFor="contactPhone">Contact Phone</label>
            <input id="contactPhone" name="contactPhone" type="tel" placeholder="+1 (555) 000-0000" />
          </div>
          <div className="form-group">
            <label htmlFor="businessDetails">Business Details</label>
            <textarea id="businessDetails" name="businessDetails" rows="3" maxLength="2000" placeholder="Products/services offered, industry, years in business..." />
          </div>
          <div className="form-group">
            <label htmlFor="documentation">Documentation</label>
            <textarea id="documentation" name="documentation" rows="2" maxLength="1000" placeholder="Licenses, certifications, insurance, or compliance documents you can provide." />
          </div>
          <div className="form-group">
            <label htmlFor="credentials">Credentials / References</label>
            <textarea id="credentials" name="credentials" rows="2" maxLength="1000" placeholder="Client references or verifiable credentials." />
          </div>
          <button type="submit" className="analyze-btn">Submit Application</button>
        </form>
        {submitted && (
          <div className="onboarding-success">
            <strong>Application submitted.</strong>
            <p>Our team has been notified and will reach out shortly.</p>
          </div>
        )}
        <p className="auth-alt">Returning user? <Link to="/login">Sign in</Link></p>
      </div>
    </div>
  );
}
