**New authentication method**  
**For DonutTrade**

*Notice: I am writing this document after finding out that to obtain a users minecraft username via Microsoft OAuth the developer needs to be accepted into a program.*

**Overview:** This document will include the new 3 methods a user can sign up with, present in the sign up page.

1. **Microsoft authentication**  
2. **Discord authentication**  
3. **Classic auhtification (email+password)**  
     
1. **Microsoft authentication**

* We will use this method to create an account using the identification string that we will receive from microsoft.  
* After receiving the identification key, they will be sent to an unskippable page where they should enter their minecraft username.  
* After that, they will be sent to another unskippable page where they have to pay our verification bot a random number between 1 and 1000 within 15 minutes.  
*  If no payment is received in this time, we will delete everything about this specific user and if they want to sign up again they have to start all over again.  
    
2. **Discord authentication**  
     
* This method will use a discord bot that will link the users discord account to ann account on our platform.  
* After successfully link their discord account, they will be sent to an unskippable page where they should enter their minecraft username.  
* After that, they will be sent to another unskippable page where they have to pay our verification bot a random number between 1 and 1000 within 15 minutes.  
*  If no payment is received in this time, we will delete everything about this specific user and if they want to sign up again they have to start all over again.  
    
3. **Classic authentication (email+password)**

* This sign up method will be 100% on our website, not relying on other 3rd party authentication methods.  
* The user will be prompted to enter their minecraft username, email, password (and retype their password) on our site. After, we will send an emai to the user with a verification code. After that, they will be sent to another unskippable page where they have to pay our verification bot a random number between 1 and 1000 within 15 minutes.  
    
    
    
  ***IMPORTANT: EVERYWHERE ON THE PLATFORM WHERE THE USER NEEDS TO ENTER THEIR USERNAME THERE SHOULD BE A DESCLAIMER SAYING THAT IF THEY HAVE A MINECRAFT BEDROCK EDITION ACCOUNT THEY SHOULD WRITE THEIR USERNAME WITH A DOT (‘.’) IN FRON.***   
  ***EXAMPLE: .givey \- for bedrock edition account and givey \- java edition account***

