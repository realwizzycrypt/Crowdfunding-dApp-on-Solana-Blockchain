use anchor_lang::prelude::*;
use anchor_lang::system_program::{transfer, Transfer};

declare_id!("H9WF79zZKbKfyLvsBkmeLsFcaqF2pwJwKz9E5feuF83q");

#[program]
pub mod anchor_project {
    use super::*;

    pub fn createCampaign(
        ctx: Context<CreateCampaign>,
        name: String,
        description: String,
        targetAmount: u64,
        campaignId: String,
    ) -> Result<()> {
        if name.is_empty() || description.is_empty() || campaignId.is_empty() {
            return err!(ErrorCode::InvalidCampaignParameters);
        }
        let campaign = &mut ctx.accounts.campaign;
        campaign.owner = *ctx.accounts.user.key;
        campaign.name = name;
        campaign.description = description;
        campaign.targetAmount = targetAmount;
        campaign.amountDonated = 0;
        campaign.campaignId = campaignId;
        campaign.bump = ctx.bumps.campaign;
        campaign.createdAt = Clock::get()?.unix_timestamp as u64;
        campaign.withdrawn = false; 

        emit!(CampaignCreated {
            campaign: campaign.key(),
            owner: campaign.owner,
            name: campaign.name.clone(),
            targetAmount: campaign.targetAmount,
            campaignId: campaign.campaignId.clone(),
        });

        Ok(())
    }

    pub fn donate(ctx: Context<Donate>, campaignId: String, amount: u64) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let remaining = campaign.targetAmount.saturating_sub(campaign.amountDonated);
        if amount > remaining {
            return err!(ErrorCode::DonationExceedsTarget);
        }

        transfer(
            CpiContext::new(
                ctx.accounts.system_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user.to_account_info(),
                    to: campaign.to_account_info(),
                },
            ),
            amount,
        )?;

        campaign.amountDonated = campaign.amountDonated.checked_add(amount).ok_or(ErrorCode::ArithmeticOverflow)?;

        emit!(DonationMade {
            campaign: campaign.key(),
            donor: *ctx.accounts.user.key,
            amount,
            campaignId: campaign.campaignId.clone(),
        });

        Ok(())
    }

    pub fn withdraw(ctx: Context<Withdraw>, _campaign_id: String) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;
        let owner = &mut ctx.accounts.owner;

        if campaign.owner != *owner.key {
            return err!(ErrorCode::Unauthorized);
        }

        let rent = Rent::get()?.minimum_balance(Campaign::INIT_SPACE);
        let balance = campaign.to_account_info().lamports();
        let available = balance.saturating_sub(rent);

        if available == 0 {
            return err!(ErrorCode::InsufficientFunds);
        }

        **campaign.to_account_info().try_borrow_mut_lamports()? -= available;
        **owner.to_account_info().try_borrow_mut_lamports()? += available;

        campaign.amountDonated = campaign.amountDonated.saturating_sub(available);
        campaign.withdrawn = true;

        emit!(WithdrawalMade {
            campaign: campaign.key(),
            owner: *owner.key,
            balance,
            campaignId: campaign.campaignId.clone(),
        });

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(name: String, description: String, targetAmount: u64, campaignId: String)]
pub struct CreateCampaign<'info> {
    #[account(
        init,
        payer = user,
        space = Campaign::INIT_SPACE,
        seeds = [b"campaign", user.key().as_ref(), campaignId.as_ref()],
        bump
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(campaignId: String)]
pub struct Donate<'info> {
    #[account(
        mut,
        seeds = [b"campaign", campaign.owner.as_ref(), campaignId.as_bytes()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(campaign_id: String)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"campaign", campaign.owner.as_ref(), campaign_id.as_bytes()],
        bump = campaign.bump,
    )]
    pub campaign: Account<'info, Campaign>,
    #[account(mut)]
    pub owner: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[account]
#[derive(InitSpace)]
pub struct Campaign {
    pub owner: Pubkey,
    #[max_len(50)]
    pub name: String,
    #[max_len(200)]
    pub description: String,
    pub amountDonated: u64,
    pub targetAmount: u64,
    #[max_len(32)]
    pub campaignId: String,
    pub bump: u8,
    pub createdAt: u64,
    pub withdrawn: bool,
}

impl Campaign {
    pub const NAME_MAX_LEN: usize = 50;
    pub const DESCRIPTION_MAX_LEN: usize = 200;
    pub const ID_MAX_LEN: usize = 32;

    pub const INIT_SPACE: usize = 8  
        + 32                         
        + 4 + Self::NAME_MAX_LEN     
        + 4 + Self::DESCRIPTION_MAX_LEN 
        + 8                          
        + 8                          
        + 4 + Self::ID_MAX_LEN       
        + 1                          
        + 8                          
        + 1;                         
}

#[error_code]
pub enum ErrorCode {
    #[msg("Campaign name, description, or ID cannot be empty")]
    InvalidCampaignParameters,
    #[msg("Donation exceeds remaining target amount")]
    DonationExceedsTarget,
    #[msg("Only the campaign owner can withdraw funds")]
    Unauthorized,
    #[msg("Insufficient funds available for withdrawal")]
    InsufficientFunds,
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
}

#[event]
pub struct CampaignCreated {
    pub campaign: Pubkey,
    pub owner: Pubkey,
    pub name: String,
    pub targetAmount: u64,
    pub campaignId: String,
}

#[event]
pub struct DonationMade {
    pub campaign: Pubkey,
    pub donor: Pubkey,
    pub amount: u64,
    pub campaignId: String,
}

#[event]
pub struct WithdrawalMade {
    pub campaign: Pubkey,
    pub owner: Pubkey,
    pub balance: u64,
    pub campaignId: String,
}