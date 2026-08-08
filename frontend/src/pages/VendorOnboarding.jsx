import { useState } from 'react';
import { useOrganization } from '../context/OrganizationContext';
import { saveLead } from '../lib/supabase';
import { showToast } from '../utils/toast';

export default function VendorOnboarding() {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
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
        organization_id: orgId
      });
      setSubmitted(true);
      e.target.reset();
      showToast('Application submitted to the pipeline.', 'success');
    } catch (err) {
      showToast(`Failed to submit application: ${err.message}`, 'error');
    }
  };

  return (
    <div className="onboarding-wrap">
      <div className="page-header">
        <div>
          <h1>Vendor Onboarding</h1>
          <p>Apply to become a vendor or invite a vendor to self-serve registration.</p>
        </div>
      </div>
      <div className="onboarding-layout">
        <div className="analytics-form-card onboarding-form-card">
          <h2>Vendor Application</h2>
          <p className="onboarding-hint">
            Your application is routed into the lead pipeline as a <strong>Prospecting</strong> lead for review.
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
            <div className="onboarding-row">
              <div className="form-group">
                <label htmlFor="contactEmail">Contact Email</label>
                <input id="contactEmail" name="contactEmail" type="email" placeholder="name@company.com" />
              </div>
              <div className="form-group">
                <label htmlFor="contactPhone">Contact Phone</label>
                <input id="contactPhone" name="contactPhone" type="tel" placeholder="+1 (555) 000-0000" />
              </div>
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
        </div>
        <div className="analytics-result-card onboarding-info-card">
          <h2>What Happens Next?</h2>
          <ol className="onboarding-steps">
            <li><strong>1. Review</strong> - Your application is reviewed by the team from the Leads page.</li>
            <li><strong>2. Due diligence</strong> - Documentation and references are verified.</li>
            <li><strong>3. Approval</strong> - Approved vendors are added to the approved vendor list.</li>
            <li><strong>4. Active</strong> - You begin receiving orders and reviews can be tracked in Analytics.</li>
          </ol>
          {submitted && (
            <div className="onboarding-success">
              <strong>Application submitted.</strong>
              <p>Our team has been notified and will reach out shortly.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
