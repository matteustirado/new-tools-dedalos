import React from 'react';
import { createPortal } from 'react-dom';
import { X, ShieldCheck } from 'lucide-react';

export default function TermsModal({ isOpen, onClose, onAgree }) {
  if (!isOpen) return null;

  const handleAgreeClick = () => {
    if (onAgree) {
      onAgree(); 
    }
    onClose();
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-fade-in" 
      onClick={onClose}
    >
      <div 
        className="bg-[#111] border border-white/10 rounded-3xl w-full max-w-lg shadow-2xl relative flex flex-col max-h-[85vh] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 md:p-6 border-b border-white/10 shrink-0 bg-black/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-full flex items-center justify-center text-yellow-500 border border-yellow-500/20 shrink-0">
              <ShieldCheck size={20} />
            </div>
            <h2 className="text-base md:text-lg font-black text-white">Termos e Privacidade</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-white/40 hover:text-white transition-colors bg-white/5 rounded-full shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 p-5 md:p-6 overflow-y-auto text-[13px] md:text-sm text-white/80 leading-relaxed space-y-6 custom-scrollbar">
          <div>
            <h3 className="text-yellow-500 font-bold mb-2 uppercase tracking-wider text-xs">1. Natureza do Aplicativo e Inexistência de Vínculo Trabalhista</h3>
            <p className="mb-2"><strong className="text-white">1.1. Uso Voluntário:</strong> A adesão e o uso do Aplicativo são de caráter estritamente voluntário e opcional. O Aplicativo consiste em uma plataforma de integração social e incentivo à saúde, não constituindo, em nenhuma hipótese, ferramenta de trabalho ou extensão da jornada laboral.</p>
            <p className="mb-2"><strong className="text-white">1.2. Prêmios e Bonificações:</strong> A Empresa poderá, por mera liberalidade, instituir campanhas de reconhecimento, concedendo prêmios, brindes ou bonificações aos Usuários que atingirem posições de destaque nos rankings do Aplicativo.</p>
            <p><strong className="text-white">1.3. Natureza Não Salarial:</strong> Fica expressamente pactuado que quaisquer premiações concedidas por meio do Aplicativo possuem natureza exclusivamente de incentivo à saúde e ao bem-estar, não possuindo natureza salarial ou retributiva, não se incorporando ao contrato de trabalho e não constituindo base de incidência de quaisquer encargos trabalhistas ou previdenciários, nos termos do Art. 457, § 4º, da CLT.</p>
          </div>

          <div>
            <h3 className="text-yellow-500 font-bold mb-2 uppercase tracking-wider text-xs">2. Diretrizes de Conteúdo e Responsabilidade do Usuário</h3>
            <p className="mb-2"><strong className="text-white">2.1. Exposição Inerente à Prática Esportiva:</strong> O Aplicativo tem como finalidade o registro de atividades físicas e o bem-estar. Reconhece-se que tais publicações podem envolver a natural exposição corporal inerente ao contexto esportivo.</p>
            <p className="mb-2"><strong className="text-white">2.2. Vedações Expressas:</strong> Não obstante a liberdade de publicação, é terminantemente proibida a postagem, o compartilhamento ou a incitação de conteúdos que configurem: nudez explícita, pornografia, atos obscenos; assédio, bullying, discursos de ódio, racismo ou qualquer forma de discriminação; violação de direitos de terceiros ou condutas tipificadas como crime pela legislação brasileira.</p>
            <p><strong className="text-white">2.3. Moderação e Sanções:</strong> A Empresa não realiza controle prévio das publicações, sendo o Usuário o único e exclusivo responsável (civil e criminalmente) pelos conteúdos que inserir. A Empresa reserva-se o direito de remover conteúdos inadequados e suspender ou banir Usuários que violem estas diretrizes, sem aviso prévio.</p>
          </div>

          <div>
            <h3 className="text-yellow-500 font-bold mb-2 uppercase tracking-wider text-xs">3. Cessão de Direitos de Imagem e Uso para IA</h3>
            <p className="mb-2"><strong className="text-white">3.1. Licença de Uso:</strong> Ao publicar fotos, textos, localização, comentários e participar de interações no Aplicativo, o Usuário concede à Empresa uma licença de uso gratuita, irrevogável, irretratável, global e por prazo indeterminado.</p>
            <p><strong className="text-white">3.2. Finalidades:</strong> A Empresa fica expressamente autorizada a utilizar o Conteúdo do Usuário para campanhas de marketing, geração de estatísticas e treinamento, desenvolvimento e aprimoramento de modelos e algoritmos de Inteligência Artificial (IA), proprietários ou de parceiros.</p>
          </div>

          <div>
            <h3 className="text-yellow-500 font-bold mb-2 uppercase tracking-wider text-xs">4. Política de Privacidade e Proteção de Dados (LGPD)</h3>
            <p className="mb-2"><strong className="text-white">4.1. Dados Coletados:</strong> Para o funcionamento do Aplicativo, coletamos dados cadastrais, de geolocalização e de atividades oriundos de integrações de terceiros (ex: Strava).</p>
            <p className="mb-2"><strong className="text-white">4.2. Tratamento e Compartilhamento:</strong> O tratamento tem como base o consentimento e o legítimo interesse. Os dados não serão comercializados, podendo ser compartilhados apenas com provedores de infraestrutura essenciais para a operação da plataforma.</p>
            <p><strong className="text-white">4.3. Retenção:</strong> Em caso de desligamento do colaborador ou exclusão da conta, os dados de acesso serão inativados. A Empresa poderá reter de forma anonimizada os dados analíticos e manter o uso das imagens já integradas a campanhas ou bases de treinamento de IA.</p>
          </div>

          <div>
            <h3 className="text-yellow-500 font-bold mb-2 uppercase tracking-wider text-xs">5. Disposições Finais</h3>
            <p>A Empresa poderá atualizar estes Termos a qualquer tempo. Alterações substanciais serão comunicadas via Aplicativo. A continuidade do uso após a notificação constituirá aceite das novas condições.</p>
          </div>
        </div>

        <div className="p-5 md:p-6 border-t border-white/10 shrink-0 bg-[#050505] flex justify-end">
           <button 
             onClick={handleAgreeClick}
             className="w-full md:w-auto px-8 py-3.5 bg-yellow-500 text-black font-black rounded-xl hover:bg-yellow-400 transition-colors active:scale-95"
           >
             CIENTE E DE ACORDO
           </button>
        </div>
      </div>
    </div>,
    document.body 
  );
}