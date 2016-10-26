'use strict';

import Base from './sysbase.js';
import crypto from 'crypto';
import cheerio from 'cheerio';
import _ from 'lodash';

export default class extends Base {
  async indexAction(){

    let httpClient = await this.getOrCreateHttpClient();
    if(this.isAjax()){
      let { username, password, captcha:yzm } = this.param();
      let [ loginmode, causername, cacert, signature ] = ['00', '', '',''];
      let { DLM } = await new Promise((resolve, reject)=>{
        httpClient.post('http://etax.jsgs.gov.cn/sso/swryHandler', {
          form: { loginmode, causername, username },
          qs: { method: 'upgradePrompt' }
        }, (error, response, body)=>{
          if(error) reject(error);
          else resolve(JSON.parse(body));
        });
      });

      let { action, execution, lt, _eventId } = await new Promise((resolve, reject)=>{
        httpClient.get('http://etax.jsgs.gov.cn/portal/login.do', (error, response, body)=>{
          if(error) reject(error);
          else{
            let $ = cheerio.load(body);
            resolve({
              action: $('#fm1').attr('action'),
              execution:$('[name=execution]').val(),
              lt:$('[name=lt]').val(),
              _eventId:$('[name=_eventId]').val()
            });
          }
        });
      });

      let sha256 = crypto.createHash('sha256');
      sha256.update(`${password}{${DLM}}`);
      let form = {
        username, password:sha256.digest('hex'), yzm,
        loginmode, causername, cacert,signature,
        execution, lt, _eventId
      };

      await new Promise((resolve, reject)=>{
        httpClient.post(`http://etax.jsgs.gov.cn${action}`, {form,followAllRedirects:true}, (error, response, body)=>{
          if(error) reject(error);
          else resolve(body);
        });
      });

      this.success({redirect:'/jsgs/show'});
    }
    else{
      let result = await new Promise((resolve, reject)=>{
        httpClient.get('http://etax.jsgs.gov.cn/sso/login', (error, response, body)=>{
          if(error)reject(error);
          else{
            resolve(body);
          }
        });
      });
      this.assign({
        result
      })
      return this.display();
    }
  }

  async captchaAction(){
    let httpClient = await this.getOrCreateHttpClient();
    httpClient.get('http://etax.jsgs.gov.cn/sso/captcha').pipe(this.http.res);
  }

  async showAction(){
    let httpClient = await this.getOrCreateHttpClient();
    let info = await new Promise((resolve, reject)=>{
      httpClient.get('http://etax.jsgs.gov.cn/portal/index.do', (error, response, body)=>{
        if(error) reject(error);
        else{
          let $ = cheerio.load(body);
          let $info = $('#div_user_info div div div');
          resolve({
            nsrmc: $info.eq(0).text(),
            nsrsbh: $info.eq(2).text()
          })
        }
      });
    });

    this.assign({info});

    return this.display();
  }
}
