package com.munify.core.config;

import com.munify.core.model.DocumentType;
import com.munify.core.model.Template;
import com.munify.core.repository.TemplateRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Seeds the database with protocol-standard MUN document templates on first startup.
 * Templates follow official United Nations formatting rules.
 */
@Configuration
public class DataSeeder {

    @Bean
    CommandLineRunner seedTemplates(TemplateRepository repo) {
        return args -> {
            if (repo.count() > 0) {
                return; // Already seeded
            }

            repo.save(Template.builder()
                    .name("Position Paper")
                    .documentType(DocumentType.POSITION_PAPER)
                    .description("A formal document outlining a country's stance on a specific topic. Structured in three paragraphs: Context, National Policy, and Proposed Solutions.")
                    .structureBody("""
                        # Position Paper: {{country}} on {{topic}}
                        ## Committee: {{committee}}

                        ### I. Context and Background
                        [Provide an overview of the issue's historical context and its current relevance to the international community.]

                        ### II. National Policy and Position
                        [Detail your country's official stance, citing relevant national legislation, past UN votes, and bilateral/multilateral agreements.]

                        ### III. Proposed Solutions
                        [Outline concrete, actionable proposals your delegation will champion. Reference existing UN frameworks and potential alliances.]
                        """)
                    .build());

            repo.save(Template.builder()
                    .name("Draft Resolution")
                    .documentType(DocumentType.RESOLUTION)
                    .description("An official resolution following strict UN formatting: italic preambulatory clauses (gerunds, ending in commas) and numbered operative clauses (imperative verbs, ending in semicolons).")
                    .structureBody("""
                        # Draft Resolution: {{topic}}
                        ## Committee: {{committee}}
                        ### Sponsors: {{country}}
                        ### Signatories: [To be determined]

                        ---

                        **The {{committee}},**

                        #### Preambulatory Clauses

                        *Recalling* [relevant UN resolutions and treaties],

                        *Acknowledging* [the current situation and its impact],

                        *Deeply concerned* [about the specific challenges],

                        *Reaffirming* [core principles of the UN Charter],

                        #### Operative Clauses

                        1. *Urges* [specific action to be taken by member states];

                        2. *Calls upon* [specific institutions or bodies to take action];

                        3. *Requests* [the Secretary-General to take specific measures];

                        4. *Encourages* [international cooperation on specific fronts];

                        5. *Decides* to remain actively seized of the matter.
                        """)
                    .build());

            repo.save(Template.builder()
                    .name("Working Paper")
                    .documentType(DocumentType.WORKING_PAPER)
                    .description("An informal document used during caucus to organize ideas and build consensus before drafting a formal resolution.")
                    .structureBody("""
                        # Working Paper: {{topic}}
                        ## Submitted by: {{country}}
                        ## Committee: {{committee}}

                        ---

                        ### Key Points for Discussion
                        1. [Point 1]
                        2. [Point 2]
                        3. [Point 3]

                        ### Potential Allies
                        - [Country/Bloc 1]
                        - [Country/Bloc 2]

                        ### Areas of Compromise
                        - [Area 1]
                        - [Area 2]

                        ### Proposed Actions
                        - [Action 1]
                        - [Action 2]
                        """)
                    .build());

            repo.save(Template.builder()
                    .name("Official Declaration")
                    .documentType(DocumentType.DECLARATION)
                    .description("A formal declaration using measured diplomatic language to express a delegation's position on an urgent matter.")
                    .structureBody("""
                        # Declaration by the Delegation of {{country}}
                        ## On the matter of: {{topic}}
                        ## Committee: {{committee}}

                        ---

                        The Delegation of {{country}} wishes to express its position on the matter of {{topic}}.

                        [Body of the declaration using formal diplomatic language. Avoid colloquial expressions. Use phrases such as "expresses its deep concern," "reaffirms its commitment," "calls upon all parties."]

                        The Delegation of {{country}} remains committed to constructive dialogue and multilateral cooperation on this critical issue.
                        """)
                    .build());

            System.out.println("✅ Seeded 4 protocol-standard MUN templates.");
        };
    }
}
